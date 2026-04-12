const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const Identity = require('./Identity');
const { encode, next } = require('../utils/userIds');
const Domain = require('./Domain');

const config = require('../config');

class ASV extends Domain {
    get supportedProperties() { return ['userId', 'firstName', 'lastName', 'birthday', 'clazz']; }
    get cacheTTL() { return 3600000; } // 1 hour

    constructor() {
        super('asv');
        const asvConfig = config.asv || {};
        // Use environment variables as fallback, tunnel might be mapped this way
        this.pool = new Pool({
            host: asvConfig.host || process.env.ASV_HOST || 'localhost',
            port: asvConfig.port || process.env.ASV_PORT || 5432,
            database: asvConfig.name || process.env.ASV_DB || 'asv',
            user: asvConfig.user || process.env.ASV_USER || 'asv',
            password: asvConfig.password || process.env.ASV_PASSWORD || 'asv'
        });
        this.schuljahr = asvConfig.schuljahr || '2025/26';
        this.lag = asvConfig.lag || '30 days';
    }

    async readIdentities() {
        let client;
        try {
            client = await this.pool.connect();
        } catch (e) {
            console.error('ASV DB Connection failed:', e.message);
            throw new Error('ASV DB Connection failed: ' + e.message);
        }
        
        try {
            // First get classes
            const classRes = await client.query(`
                select k.id, k.klassenname
                from asv.svp_klasse k
                where k.schule_schuljahr_id in (
                    select ss.id from asv.svp_wl_schuljahr sj, asv.svp_schule_schuljahr ss
                    where sj.id = ss.schuljahr_id and sj.kurzform = $1
                )
                and k.wl_klassenart_id in (
                    select id from asv.svp_wl_wert
                    where werteliste_id in (
                        select id from asv.svp_wl_werteliste where bezeichnung = 'KLASSENART'
                    )
                    and kurzform != 'ORG'
                )
            `, [this.schuljahr]);
            const classes = {};
            classRes.rows.forEach(r => {
                if (!r.klassenname.includes('-')) {
                    classes[r.id] = r.klassenname;
                }
            });

            // Get genders map
            const genderRes = await client.query(`
                select w.id, w.kurzform from asv.svp_wl_wert w
                where w.werteliste_id in (select id from asv.svp_wl_werteliste where bezeichnung = 'GESCHLECHT')
            `);
            const genders = {};
            genderRes.rows.forEach(r => {
                genders[r.id] = (r.kurzform || '').toUpperCase();
            });

            // Get student identities
            const studentRes = await client.query(`
                select u.userid, s.vornamen, s.familienname, s.wl_geschlecht_id, s.geburtsdatum, kg.klasse_id
                from asv.svp_schueler_stamm s, sync.user_id u, asv.svp_schueler_schuljahr sj, asv.svp_klassengruppe kg
                where s.id in (
                    select schueler_stamm_id from asv.svp_schueler_schuljahr where schuljahr_id in (
                        select id from asv.svp_wl_schuljahr where kurzform = $1
                    )
                )
                and (s.austrittsdatum is null or s.austrittsdatum > date(now() - $2::interval))
                and sj.schueler_stamm_id = s.id
                and sj.klassengruppe_id = kg.id
                and u.id = s.id
            `, [this.schuljahr, this.lag]);

            const identities = [];
            for (const r of studentRes.rows) {
                const clazz = classes[r.klasse_id];
                if (clazz) {
                    identities.push(new Identity(
                        r.userid,
                        r.vornamen,
                        r.familienname,
                        {
                            birthday: r.geburtsdatum ? r.geburtsdatum.toISOString().split('T')[0] : null,
                            clazz: clazz,
                            gender: genders[r.wl_geschlecht_id] || ''
                        }
                    ));
                }
            }
            return identities;
        } catch(e) {
            console.error('ASV query failed', e);
            throw new Error('ASV query failed: ' + e.message);
        } finally {
            client.release();
        }
    }

    async generateIds() {
        let client;
        try {
            client = await this.pool.connect();
        } catch (e) {
            console.error('ASV DB Connection failed:', e.message);
            throw new Error('ASV DB Connection failed: ' + e.message);
        }

        try {
            await client.query('BEGIN'); // wrap in transaction for safety
            
            const len = config.account?.maxlength || 18;

            // Fetch students without an ID in sync.user_id
            const missingRes = await client.query(`
                select id, vornamen, familienname 
                from asv.svp_schueler_stamm 
                where id not in (select id from sync.user_id)
            `);
            
            const missing = missingRes.rows;
            const generated = [];

            for (const student of missing) {
                let like = encode(student.familienname);
                if (like.length > len - 6) {
                    like = like.substring(0, len - 6);
                }

                // Fetch similar userids
                const similarRes = await client.query(`
                    select userid from sync.user_id where userid like $1
                `, [like + '%']);
                
                const similar = similarRes.rows.map(r => r.userid);

                const userid = next(len, similar, student.vornamen, student.familienname);

                // Insert new userid mapping
                await client.query(`
                    insert into sync.user_id (id, userid) values ($1, $2)
                `, [student.id, userid]);

                generated.push({ id: student.id, account: userid, firstName: student.vornamen, lastName: student.familienname });
            }

            await client.query('COMMIT');
            if (generated.length > 0) {
                console.log(`ASV ID Generator: Created ${generated.length} new IDs.`);
            }
            return generated;
        } catch(e) {
            await client.query('ROLLBACK');
            console.error('ASV ID Generator failed', e);
            throw new Error('ASV ID Generator failed: ' + e.message);
        } finally {
            client.release();
        }
    }
    async readExitDates(usernames) {
        if (!usernames || usernames.length === 0) return {};
        
        const client = await this.pool.connect();
        try {
            const query = `
                select u.userid, s.austrittsdatum
                from asv.svp_schueler_stamm s, sync.user_id u
                where s.austrittsdatum <= date(now())
                and u.id = s.id
                and u.userid = ANY($1::varchar[])
            `;
            
            const res = await client.query(query, [usernames]);
            
            const map = {};
            for (const row of res.rows) {
                if (row.austrittsdatum) {
                     map[row.userid] = row.austrittsdatum.toISOString().split('T')[0];
                }
            }
            return map;
        } catch (e) {
            console.error('ASV readExitDates failed', e);
            throw new Error('ASV readExitDates failed: ' + e.message);
        } finally {
            client.release();
        }
    }
}

module.exports = new ASV();
