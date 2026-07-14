#!/usr/bin/env node
/**
 * Delete one or more Matrix rooms via Tuwunel's #admins room commands.
 * Kicks all members first, then deletes the room.
 * 
 * Usage: node backend/scripts/delete-rooms.js <roomId> [roomId2] ...
 */
const config = require('../src/config');

const RESPONSE_WAIT_MS = 3000;

async function getAdminToken(matrix) {
    const { homeserverUrl, adminUsername, adminPassword } = matrix;

    const loginRes = await fetch(`${homeserverUrl}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'm.login.password',
            identifier: { type: 'm.id.user', user: adminUsername },
            password: adminPassword
        })
    });

    if (!loginRes.ok) {
        throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
    }

    const data = await loginRes.json();
    console.log(`✓ Logged in as ${data.user_id}`);
    return { token: data.access_token, userId: data.user_id };
}

async function matrixGet(homeserverUrl, token, path) {
    const res = await fetch(`${homeserverUrl}/_matrix/client/v3${path}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return res.json();
}

async function matrixPost(homeserverUrl, token, path, body = {}) {
    return fetch(`${homeserverUrl}/_matrix/client/v3${path}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
}

async function resolveAlias(homeserverUrl, token, alias) {
    const data = await matrixGet(homeserverUrl, token, `/directory/room/${encodeURIComponent(alias)}`);
    return data?.room_id || null;
}

async function sendAdminCommand(homeserverUrl, token, adminRoomId, userId, command) {
    const txnId = `${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const sendRes = await fetch(
        `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(adminRoomId)}/send/m.room.message/${txnId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ msgtype: 'm.text', body: command })
        }
    );

    if (!sendRes.ok) {
        throw new Error(`Failed to send command: ${await sendRes.text()}`);
    }

    await new Promise(r => setTimeout(r, RESPONSE_WAIT_MS));

    const msgsRes = await fetch(
        `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(adminRoomId)}/messages?dir=b&limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }
    );

    if (!msgsRes.ok) {
        throw new Error(`Failed to read response: ${await msgsRes.text()}`);
    }

    const msgs = await msgsRes.json();
    const botMsg = (msgs.chunk || []).find(c =>
        c.sender && c.sender !== userId && c.content?.body
    );
    return botMsg?.content?.body || '(no response)';
}

async function getJoinedMembers(homeserverUrl, token, roomId) {
    const data = await matrixGet(homeserverUrl, token, `/rooms/${encodeURIComponent(roomId)}/joined_members`);
    return Object.keys(data?.joined || {});
}

async function deleteRoom(homeserverUrl, token, adminRoomId, userId, roomId) {
    console.log(`\n--- Room: ${roomId} ---`);

    // 1. Bot joins the room first (needed to kick members)
    console.log('  Joining room...');
    const joinRes = await matrixPost(homeserverUrl, token, `/join/${encodeURIComponent(roomId)}`);
    if (!joinRes.ok) {
        console.warn(`  ⚠ Could not join room: ${await joinRes.text()}`);
    }

    // 2. Get all members
    console.log('  Getting members...');
    const members = await getJoinedMembers(homeserverUrl, token, roomId);
    console.log(`  Found ${members.length} members`);

    // 3. Kick all members (except our bot)
    const botMxid = userId;
    const toKick = members.filter(m => m !== botMxid);

    if (toKick.length > 0) {
        console.log(`  Kicking ${toKick.length} members...`);
        for (const mxid of toKick) {
            try {
                const kickRes = await matrixPost(homeserverUrl, token,
                    `/rooms/${encodeURIComponent(roomId)}/kick`,
                    { user_id: mxid, reason: 'Room is being deleted' }
                );
                if (kickRes.ok) {
                    console.log(`    ✓ Kicked ${mxid}`);
                } else {
                    // Try via admin command if direct kick fails
                    console.log(`    ⚠ Direct kick failed for ${mxid}, trying admin force-leave...`);
                    const resp = await sendAdminCommand(homeserverUrl, token, adminRoomId, userId,
                        `!admin users force-leave-room ${mxid} ${roomId}`
                    );
                    console.log(`    → ${resp}`);
                }
            } catch (e) {
                console.warn(`    ✗ Failed to kick ${mxid}: ${e.message}`);
            }
        }
    }

    // 4. Bot leaves the room
    console.log('  Bot leaving room...');
    await matrixPost(homeserverUrl, token, `/rooms/${encodeURIComponent(roomId)}/leave`);

    // 5. Delete the room
    console.log('  Deleting room...');
    const response = await sendAdminCommand(homeserverUrl, token, adminRoomId, userId,
        `!admin rooms delete --force ${roomId}`
    );
    console.log(`  → ${response}`);
}

async function main() {
    const roomIds = process.argv.slice(2);
    if (roomIds.length === 0) {
        console.error('Usage: node backend/scripts/delete-rooms.js <roomId> [roomId2] ...');
        console.error("Example: node backend/scripts/delete-rooms.js '!abc123:example.com'");
        process.exit(1);
    }

    const matrix = config.matrix;
    const homeserverUrl = matrix.homeserverUrl;
    const domain = new URL(homeserverUrl).hostname.replace(/^matrix\./, '');
    console.log(`Homeserver: ${homeserverUrl}`);
    console.log(`Rooms to delete: ${roomIds.length}`);

    const { token, userId } = await getAdminToken(matrix);

    const adminRoomId = await resolveAlias(homeserverUrl, token, `#admins:${domain}`);
    if (!adminRoomId) {
        throw new Error(`Could not resolve #admins:${domain}`);
    }
    console.log(`✓ Resolved #admins room: ${adminRoomId}`);

    for (const roomId of roomIds) {
        try {
            await deleteRoom(homeserverUrl, token, adminRoomId, userId, roomId);
        } catch (e) {
            console.error(`  ✗ Failed: ${e.message}`);
        }
    }

    console.log('\nDone.');
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
