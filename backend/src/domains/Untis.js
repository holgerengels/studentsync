const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const Identity = require('./Identity');
const Domain = require('./Domain');

const config = require('../config');

class Untis extends Domain {
    get supportedProperties() { return ['userId', 'firstName', 'lastName', 'birthday', 'clazz']; }
    get cacheTTL() { return 3600000; } // 1 hour

    constructor() {
        super('untis');
        const c = config.untis || {};
        const host = c.host || process.env.UNTIS_HOST;
        const port = c.port || process.env.UNTIS_PORT;
        const database = c.name || process.env.UNTIS_DB;
        const user = c.user || process.env.UNTIS_USER;
        const password = c.password || process.env.UNTIS_PASSWORD;

        if (!host || !port || !database || !user || !password) {
            throw new Error('Untis Database configuration is incomplete. Missing host, port, name, user, or password.');
        }

        this.dbConfig = { host, port, database, user, password };

        this.schulid = c.schulid;
        this.version = c.version;
        this.schuljahr = c.schuljahr;

        if (!this.schulid || !this.version || !this.schuljahr) {
            throw new Error('Untis configuration is incomplete. Missing schulid, version, or schuljahr.');
        }

        this.emailDomain = c.emailDomain || process.env.UNTIS_EMAIL_DOMAIN;
        if (!this.emailDomain) {
            throw new Error('Untis configuration error: Missing emailDomain for teacher login sync.');
        }
    }

    async readIdentities() {
        let connection;
        try {
            connection = await mysql.createConnection(this.dbConfig);
        } catch (e) {
            // console.error('Untis DB Connection failed:', e.message);
            throw new Error('Untis DB Connection failed: ' + e.message);
        }

        try {
            const [classRows] = await connection.execute(
                "SELECT CLASS_ID, Name FROM Class where SCHOOL_ID = ? and VERSION_ID = ? AND SCHOOLYEAR_ID = ?",
                [this.schulid, this.version, this.schuljahr]
            );
            const classes = {};
            classRows.forEach(r => classes[r.CLASS_ID] = r.Name);

            const [studentRows] = await connection.execute(
                "SELECT distinct s.STUDENT_ID, s.Name, s.FirstName, s.Longname, s.Flags, s.BirthDate, s.CLASS_ID FROM Student s where s.SCHOOL_ID = ? and s.VERSION_ID = ? and s.SCHOOLYEAR_ID = ?",
                [this.schulid, this.version, this.schuljahr]
            );

            return studentRows.map(r => {
                let birthday = null;
                if (r.BirthDate && r.BirthDate.toString() !== '0') {
                    const str = r.BirthDate.toString();
                    if (str.length === 8) {
                        const year = parseInt(str.substring(0, 4), 10);
                        const month = parseInt(str.substring(4, 6), 10) - 1;
                        const day = parseInt(str.substring(6, 8), 10);
                        const d = new Date(Date.UTC(year, month, day));
                        birthday = d.toISOString().split('T')[0];
                    }
                }
                return new Identity(
                    r.Name, // userId mapped to Name in Untis
                    r.FirstName,
                    r.Longname,
                    {
                        id: r.STUDENT_ID,
                        birthday: birthday,
                        clazz: classes[r.CLASS_ID]
                    }
                );
            }).filter(id => id.userId);
        } catch(e) {
            console.error('Untis query failed', e);
            throw new Error('Untis query failed: ' + e.message);
        } finally {
            if (connection) await connection.end();
        }
    }

    async teacherExternalIds() {
        let connection;
        try {
            connection = await mysql.createConnection(this.dbConfig);
            const [rows] = await connection.execute("SELECT name, email, foreignkey FROM Teacher");
            
            const updatedIds = [];
            const missingDomain = [];
            const suffix = '@' + this.emailDomain;
            
            for (const row of rows) {
                if (!row.email || !row.email.endsWith(suffix)) {
                    missingDomain.push(row.name);
                } else {
                    const expectedForeignKey = row.email.substring(0, row.email.length - suffix.length);
                    if (row.foreignkey !== expectedForeignKey) {
                        await connection.execute(
                            "UPDATE Teacher SET foreignkey = ? WHERE name = ?",
                            [expectedForeignKey, row.name]
                        );
                        updatedIds.push(row.name);
                    }
                }
            }
            
            return { updatedIds, missingDomain };
        } catch(e) {
            console.error('Untis teacherExternalIds query failed', e);
            throw new Error('Untis teacherExternalIds query failed: ' + e.message);
        } finally {
            if (connection) await connection.end();
        }
    }
}

module.exports = new Untis();
