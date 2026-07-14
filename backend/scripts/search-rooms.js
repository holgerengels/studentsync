#!/usr/bin/env node
/**
 * Search for rooms on the server by name pattern.
 * Uses the public rooms directory and admin commands.
 */
const config = require('../src/config');

async function main() {
    const matrix = config.matrix;
    const search = process.argv[2] || '';

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
    const { access_token: token } = await loginRes.json();

    // Search public rooms
    console.log(`Searching all rooms for "${search}"...\n`);
    
    let allRooms = [];
    let nextBatch = null;
    do {
        const body = { limit: 100 };
        if (search) body.filter = { generic_search_term: search };
        if (nextBatch) body.since = nextBatch;

        const res = await fetch(`${matrix.homeserverUrl}/_matrix/client/v3/publicRooms`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            console.error(`Search failed: ${await res.text()}`);
            break;
        }
        const data = await res.json();
        allRooms = allRooms.concat(data.chunk || []);
        nextBatch = data.next_batch || null;
    } while (nextBatch);

    if (allRooms.length === 0) {
        console.log('No rooms found.');
        return;
    }

    // Filter locally if search term given
    const filtered = search 
        ? allRooms.filter(r => 
            (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.canonical_alias || '').toLowerCase().includes(search.toLowerCase())
          )
        : allRooms;

    console.log(`Found ${filtered.length} rooms:\n`);
    for (const r of filtered) {
        console.log(`  ${r.name || '(unnamed)'}  ${r.canonical_alias || ''}  members=${r.num_joined_members}  [${r.room_id}]`);
    }
}

main().catch(e => console.error('Error:', e.message));
