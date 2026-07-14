#!/usr/bin/env node
/**
 * List all rooms the bot user is in, to check if Moodle created a new room.
 */
const config = require('../src/config');

async function main() {
    const matrix = config.matrix;

    // Login
    const loginRes = await fetch(`${matrix.homeserverUrl}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'm.login.password',
            identifier: { type: 'm.id.user', user: matrix.adminUsername },
            password: matrix.adminPassword
        })
    });
    if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`);
    const { access_token: token, user_id: userId } = await loginRes.json();
    console.log(`✓ Logged in as ${userId}\n`);

    // Get joined rooms
    const roomsRes = await fetch(`${matrix.homeserverUrl}/_matrix/client/v3/joined_rooms`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!roomsRes.ok) throw new Error(`Failed to get rooms: ${await roomsRes.text()}`);
    const { joined_rooms } = await roomsRes.json();

    console.log(`Rooms (${joined_rooms.length}):\n`);

    for (const roomId of joined_rooms) {
        let name = roomId;
        let alias = '';
        try {
            const nameRes = await fetch(
                `${matrix.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (nameRes.ok) {
                const data = await nameRes.json();
                name = data.name || roomId;
            }
        } catch {}
        try {
            const aliasRes = await fetch(
                `${matrix.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.canonical_alias`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (aliasRes.ok) {
                const data = await aliasRes.json();
                alias = data.alias || '';
            }
        } catch {}

        console.log(`  ${name}${alias ? '  (' + alias + ')' : ''}  [${roomId}]`);
    }
}

main().catch(e => console.error('Error:', e.message));
