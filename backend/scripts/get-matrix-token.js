#!/usr/bin/env node
/**
 * Get an access token for the Matrix bot user.
 * This token can be used to configure Moodle's Matrix Communication Provider.
 */
const config = require('../src/config');

async function main() {
    const matrix = config.matrix;
    console.log(`Homeserver: ${matrix.homeserverUrl}`);
    console.log(`User: ${matrix.adminUsername}`);

    const loginRes = await fetch(`${matrix.homeserverUrl}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'm.login.password',
            identifier: { type: 'm.id.user', user: matrix.adminUsername },
            password: matrix.adminPassword
        })
    });

    if (!loginRes.ok) {
        throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
    }

    const data = await loginRes.json();
    console.log(`\n✓ Logged in as ${data.user_id}`);
    console.log(`\nAccess Token:\n${data.access_token}`);
    console.log(`\nDiesen Token in Moodle eintragen unter:`);
    console.log(`Site Administration → Plugins → Communication → Matrix → Access Token`);
}

main().catch(e => console.error('Error:', e.message));
