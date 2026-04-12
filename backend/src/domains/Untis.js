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
        this.dbConfig = {
            host: c.host || process.env.UNTIS_HOST || 'localhost',
            port: c.port || process.env.UNTIS_PORT || 3306,
            database: c.name || process.env.UNTIS_DB || 'untis',
            user: c.user || process.env.UNTIS_USER || 'untis',
            password: c.password || process.env.UNTIS_PASSWORD || 'untis'
        };
        this.schulid = c.schulid || '1';
        this.version = c.version || '1';
        this.schuljahr = c.schuljahr || '20252026';
    }

    async readIdentities() {
        let connection;
        try {
            connection = await mysql.createConnection(this.dbConfig);
        } catch (e) {
            console.error('Untis DB Connection failed:', e.message);
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
                        const d = new Date(Date.UTC(year, month, day - 1));
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
}

module.exports = new Untis();
