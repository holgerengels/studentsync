const mysql = require('mysql2/promise');
const untis = require('./src/domains/Untis');

async function run() {
    let connection;
    try {
        console.log('Connecting to Untis database...');
        connection = await mysql.createConnection(untis.dbConfig);
        
        console.log('Fetching teachers...');
        const [rows] = await connection.execute("SELECT name, email, foreignkey FROM Teacher");
        
        console.table(rows);
        console.log(`\nTotal teachers found: ${rows.length}`);
    } catch (e) {
        console.error('Error fetching teachers:', e);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

run();
