const { Pool } = require('pg');
const Identity = require('../../domains/Identity');
const Domain = require('../../domains/Domain');
const config = require('../../config');

class ASVTeacher extends Domain {
    get supportedProperties() { return ['userId', 'firstName', 'lastName', 'email', 'login']; }
    get cacheTTL() { return 3600000; } // 1 hour

    constructor() {
        super('asv-teacher');
        const asvConfig = config.asv || {};
        const host = asvConfig.host || process.env.ASV_HOST;
        const port = asvConfig.port || process.env.ASV_PORT;
        const database = asvConfig.name || process.env.ASV_DB;
        const user = asvConfig.user || process.env.ASV_USER;
        const password = asvConfig.password || process.env.ASV_PASSWORD;

        if (!host || !port || !database || !user || !password) {
            throw new Error('ASV Database configuration is incomplete. Missing host, port, name, user, or password.');
        }

        this.pool = new Pool({ host, port, database, user, password });

        this.schuljahr = asvConfig.schuljahr;
        if (!this.schuljahr) throw new Error('ASV schuljahr missing');
    }

    async readIdentities() {
        let client;
        try {
            client = await this.pool.connect();
        } catch (e) {
            throw new Error('ASV Teacher DB Connection failed: ' + e.message);
        }

        try {
            // Join path: svp_lehrer_schuljahr_schule → svp_lehrer_schuljahr → svp_lehrer_stamm
            // namenskuerzel (the teacher abbreviation like "be", "kr") lives in svp_lehrer_schuljahr_schule
            // Communication via svp_lehrer_stamm_kommunikation, E-Mail type '1113_EMAIL'
            const res = await client.query(`
                SELECT lss.namenskuerzel, lst.familienname, lst.vornamen,
                       lower(ko.kommunikationsadresse) AS email
                FROM asv.svp_lehrer_schuljahr_schule lss,
                     asv.svp_lehrer_schuljahr ls,
                     asv.svp_lehrer_stamm lst,
                     asv.svp_lehrer_stamm_kommunikation lsk,
                     asv.svp_kommunikation ko
                WHERE lss.schule_schuljahr_id IN (
                    SELECT ss.id FROM asv.svp_wl_schuljahr sj, asv.svp_schule_schuljahr ss
                    WHERE sj.id = ss.schuljahr_id AND sj.kurzform = $1
                )
                AND lss.lehrer_schuljahr_id = ls.id
                AND ls.lehrer_stamm_id = lst.id
                AND lsk.lehrer_stamm_id = ls.lehrer_stamm_id
                AND lsk.kommunikation_id = ko.id
                AND ko.wl_kommunikationstyp_id = '1113_EMAIL'
                ORDER BY lower(ko.kommunikationsadresse)
            `, [this.schuljahr]);

            const identities = [];
            const seen = new Set();
            for (const r of res.rows) {
                const email = (r.email || '').trim();
                if (!email.includes('@')) continue;

                // Deduplicate by namenskuerzel
                if (seen.has(r.namenskuerzel)) continue;
                seen.add(r.namenskuerzel);

                let login = null;
                if (email.includes('@')) {
                    login = email.split('@')[0];
                }

                identities.push(new Identity(
                    r.namenskuerzel,
                    r.vornamen,
                    r.familienname,
                    { email, login }
                ));
            }
            return identities;
        } catch (e) {
            console.error('ASV Teacher query failed', e);
            throw new Error('ASV Teacher query failed: ' + e.message);
        } finally {
            client.release();
        }
    }
}

module.exports = new ASVTeacher();
