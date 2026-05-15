const mysql = require('mysql2/promise');
const Identity = require('../../domains/Identity');
const Domain = require('../../domains/Domain');
const config = require('../../config');

class UntisTeacher extends Domain {
    get supportedProperties() { return ['userId', 'firstName', 'lastName']; }
    get cacheTTL() { return 3600000; } // 1 hour

    constructor() {
        super('untis-teacher');
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
        this.emailDomain = c.emailDomain;

        if (!this.schulid || !this.version || !this.schuljahr) {
            throw new Error('Untis configuration is incomplete. Missing schulid, version, or schuljahr.');
        }
        if (!this.emailDomain) {
            throw new Error('Untis configuration error: Missing emailDomain for teacher login sync.');
        }
    }

    async readIdentities() {
        let connection;
        try {
            connection = await mysql.createConnection(this.dbConfig);
        } catch (e) {
            throw new Error('Untis Teacher DB Connection failed: ' + e.message);
        }

        try {
            const [rows] = await connection.execute(
                `SELECT TEACHER_ID, Name, FirstName, Longname, Email, ForeignKey, BirthDate
                 FROM Teacher
                 WHERE SCHOOL_ID = ? AND VERSION_ID = ? AND SCHOOLYEAR_ID = ?
                   AND Deleted != 1
                   AND Name NOT LIKE 'zz\\_%'`,
                [this.schulid, this.version, this.schuljahr]
            );

            return rows.map(r => {
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
                    r.Name,
                    r.FirstName,
                    r.Longname,
                    {
                        id: r.TEACHER_ID,
                        email: r.Email,
                        foreignKey: r.ForeignKey,
                        birthday
                    }
                );
            }).filter(id => id.userId);
        } catch(e) {
            console.error('Untis Teacher query failed', e);
            throw new Error('Untis Teacher query failed: ' + e.message);
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Read-only: Returns teachers whose foreignkey doesn't match the expected value
     * derived from their email address.
     * @returns {{ pending: Array<{name: string, foreignKey: string}>, missingDomain: string[] }}
     */
    async readTeachersWithMissingExternalIds() {
        let connection;
        try {
            connection = await mysql.createConnection(this.dbConfig);
            const [rows] = await connection.execute("SELECT name, email, foreignkey FROM Teacher");

            const pending = [];
            const missingDomain = [];
            const suffix = '@' + this.emailDomain;
            const seen = new Set();

            for (const row of rows) {
                if (!row.email || !row.email.endsWith(suffix)) {
                    missingDomain.push(row.name);
                } else {
                    const expectedForeignKey = row.email.substring(0, row.email.length - suffix.length);
                    if (!seen.has(row.name) && row.foreignkey !== expectedForeignKey) {
                        pending.push({ name: row.name, foreignKey: expectedForeignKey });
                        seen.add(row.name);
                    }
                }
            }

            return { pending, missingDomain };
        } catch(e) {
            console.error('UntisTeacher readTeachersWithMissingExternalIds failed', e);
            throw new Error('UntisTeacher readTeachersWithMissingExternalIds failed: ' + e.message);
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Write a single teacher's external ID (foreignkey).
     */
    async writeTeacherExternalId(name, foreignKey) {
        let connection;
        try {
            connection = await mysql.createConnection(this.dbConfig);
            await connection.execute(
                "UPDATE Teacher SET foreignkey = ? WHERE name = ?",
                [foreignKey, name]
            );
        } catch(e) {
            console.error(`UntisTeacher writeTeacherExternalId failed for ${name}`, e);
            throw new Error(`UntisTeacher writeTeacherExternalId failed for ${name}: ${e.message}`);
        } finally {
            if (connection) await connection.end();
        }
    }
}

module.exports = new UntisTeacher();
