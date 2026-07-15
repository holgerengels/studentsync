#!/usr/bin/env node
const mongoose = require('mongoose');
const config = require('../src/config');

const RESPONSE_WAIT_MS = 100;

const moodleRoomSchema = new mongoose.Schema({
    courseId: { type: Number, required: true, unique: true },
    courseName: String,
    roomId: { type: String, required: true },
    categoryId: Number
});
const MoodleRoomModel = mongoose.models.MoodleRoom || mongoose.model('MoodleRoom', moodleRoomSchema);

const moodleSpaceSchema = new mongoose.Schema({
    categoryId: { type: Number, required: true, unique: true },
    categoryName: String,
    spaceId: { type: String, required: true }
});
const MoodleSpaceModel = mongoose.models.MoodleSpace || mongoose.model('MoodleSpace', moodleSpaceSchema);

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

async function sendAdminCommand(homeserverUrl, token, adminRoomId, command) {
    const txnId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await fetch(`${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(adminRoomId)}/send/m.room.message/${txnId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ msgtype: 'm.text', body: command })
    });
    await new Promise(r => setTimeout(r, RESPONSE_WAIT_MS));
}

async function getJoinedMembers(homeserverUrl, token, roomId) {
    const data = await matrixGet(homeserverUrl, token, `/rooms/${encodeURIComponent(roomId)}/joined_members`);
    return Object.keys(data?.joined || {});
}

async function deleteMatrixRoom(homeserverUrl, token, adminRoomId, botMxid, roomId, name) {
    console.log(`\nDeleting room "${name}" (${roomId})...`);

    // 1. Bot joins room first to be able to kick
    try {
        await matrixPost(homeserverUrl, token, `/join/${encodeURIComponent(roomId)}`);
    } catch (e) { /* ignore */ }

    // 2. Get and kick members
    try {
        const members = await getJoinedMembers(homeserverUrl, token, roomId);
        const toKick = members.filter(m => m !== botMxid);
        console.log(`  Found ${members.length} members. Kicking ${toKick.length} users...`);
        for (const mxid of toKick) {
            try {
                const kickRes = await matrixPost(homeserverUrl, token, `/rooms/${encodeURIComponent(roomId)}/kick`, {
                    user_id: mxid,
                    reason: 'Moodle course room deletion'
                });
                if (!kickRes.ok && adminRoomId) {
                    await sendAdminCommand(homeserverUrl, token, adminRoomId, `!admin users force-leave-room ${mxid} ${roomId}`);
                }
            } catch (e) { /* ignore */ }
        }
    } catch (e) { /* ignore */ }

    // 3. Bot leaves room
    try {
        await matrixPost(homeserverUrl, token, `/rooms/${encodeURIComponent(roomId)}/leave`);
    } catch (e) { /* ignore */ }

    // 4. Delete the room via admin command
    if (adminRoomId) {
        try {
            await sendAdminCommand(homeserverUrl, token, adminRoomId, `!admin rooms delete --force ${roomId}`);
            console.log(`  ✓ Sent deletion command for ${roomId}`);
        } catch (e) {
            console.warn(`  ✗ Failed to send delete command: ${e.message}`);
        }
    }
}

async function main() {
    // Connect DB
    const mongoUri = config.mongodb?.uri || 'mongodb://localhost:27017/synx_logs';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const matrix = config.matrix;
    const homeserverUrl = matrix.homeserverUrl;
    const domain = new URL(homeserverUrl).hostname.replace(/^matrix\./, '');
    const { token, userId } = await getAdminToken(matrix);

    const adminRoomId = await resolveAlias(homeserverUrl, token, `#admins:${domain}`);
    if (!adminRoomId) {
        console.warn(`Warning: Could not resolve #admins:${domain}. Direct kicks will be attempted but room deletion commands may fail.`);
    } else {
        console.log(`✓ Resolved #admins room: ${adminRoomId}`);
    }

    // Get all joined rooms on Matrix
    console.log('Fetching all rooms the bot is joined in from Matrix...');
    const roomsRes = await fetch(`${homeserverUrl}/_matrix/client/v3/joined_rooms`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!roomsRes.ok) {
        throw new Error(`Failed to get joined rooms: ${await roomsRes.text()}`);
    }
    const { joined_rooms } = await roomsRes.json();
    console.log(`Found ${joined_rooms.length} total rooms joined by the bot.`);

    let deletedCount = 0;

    for (const roomId of joined_rooms) {
        // Fetch canonical alias to check if it's a Moodle room or space
        let alias = '';
        let roomName = roomId;
        try {
            const aliasRes = await fetch(
                `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.canonical_alias`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (aliasRes.ok) {
                const data = await aliasRes.json();
                alias = data.alias || '';
            }
        } catch {}

        try {
            const nameRes = await fetch(
                `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (nameRes.ok) {
                const data = await nameRes.json();
                roomName = data.name || roomId;
            }
        } catch {}

        // Check if alias matches Moodle naming convention
        const isMoodleRoom = alias.startsWith('#moodle_course_');
        const isMoodleSpace = alias.startsWith('#moodle_cat_');

        if (isMoodleRoom || isMoodleSpace) {
            console.log(`\nMatching Moodle room/space found: "${roomName}" (Alias: ${alias}, ID: ${roomId})`);
            await deleteMatrixRoom(homeserverUrl, token, adminRoomId, userId, roomId, roomName);
            
            // Also clean up any tracking records in DB if they exist
            await MoodleRoomModel.deleteOne({ roomId });
            await MoodleSpaceModel.deleteOne({ spaceId: roomId });
            deletedCount++;
        }
    }

    await mongoose.disconnect();
    console.log(`\nWipe completed. Deleted ${deletedCount} Moodle rooms/spaces.`);
}

main().catch(e => {
    console.error('Error:', e.message);
    mongoose.disconnect().catch(() => {});
    process.exit(1);
});
