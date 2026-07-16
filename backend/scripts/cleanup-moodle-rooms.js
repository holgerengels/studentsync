#!/usr/bin/env node
/**
 * Cleanup stale Moodle course rooms from Matrix.
 * 
 * For every Moodle course WITHOUT matrix_enabled, checks if a
 * #moodle_course_<id> room exists and deletes it via Tuwunel admin commands.
 * 
 * Usage:
 *   node backend/scripts/cleanup-moodle-rooms.js          # Dry run
 *   node backend/scripts/cleanup-moodle-rooms.js --delete  # Delete
 */
const config = require('../src/config');

const RESPONSE_WAIT_MS = 3000;

async function moodleCall(moodleConfig, wsfunction, params = {}) {
    const url = new URL(moodleConfig.url);
    url.pathname = '/webservice/rest/server.php';
    url.searchParams.set('wstoken', moodleConfig.token);
    url.searchParams.set('wsfunction', wsfunction);
    url.searchParams.set('moodlewsrestformat', 'json');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.exception) throw new Error(`${wsfunction}: ${data.message}`);
    return data;
}

function getIncludedCategoryIds(categories, includeNames) {
    const rootIds = new Set();
    for (const cat of categories) {
        if (includeNames.some(n => cat.name.toLowerCase() === n.toLowerCase())) rootIds.add(cat.id);
    }
    const included = new Set(rootIds);
    const queue = [...rootIds];
    while (queue.length > 0) {
        const parentId = queue.shift();
        for (const cat of categories) {
            if (cat.parent === parentId && !included.has(cat.id)) { included.add(cat.id); queue.push(cat.id); }
        }
    }
    return included;
}

async function matrixLogin(matrix) {
    const res = await fetch(`${matrix.homeserverUrl}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'm.login.password', identifier: { type: 'm.id.user', user: matrix.adminUsername }, password: matrix.adminPassword })
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    return await res.json();
}

async function resolveAlias(homeserverUrl, token, alias) {
    try {
        const res = await fetch(`${homeserverUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(alias)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) return (await res.json()).room_id;
    } catch (e) { /* ignore */ }
    return null;
}

async function sendAdminCommand(homeserverUrl, token, adminRoomId, userId, command) {
    const txnId = `${Date.now()}_${Math.random().toString(36).substring(2)}`;
    await fetch(`${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(adminRoomId)}/send/m.room.message/${txnId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ msgtype: 'm.text', body: command })
    });
    await new Promise(r => setTimeout(r, RESPONSE_WAIT_MS));
}

async function getJoinedMembers(homeserverUrl, token, roomId) {
    try {
        const res = await fetch(`${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/joined_members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) return Object.keys((await res.json()).joined || {});
    } catch (e) { /* ignore */ }
    return [];
}

async function deleteRoom(homeserverUrl, token, adminRoomId, userId, roomId) {
    // Join room first
    await fetch(`${homeserverUrl}/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}'
    });

    // Kick members
    const members = await getJoinedMembers(homeserverUrl, token, roomId);
    for (const mxid of members.filter(m => m !== userId)) {
        try {
            const kickRes = await fetch(`${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/kick`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: mxid, reason: 'Room cleanup: matrix_enabled not set' })
            });
            if (!kickRes.ok) {
                await sendAdminCommand(homeserverUrl, token, adminRoomId, userId,
                    `!admin users force-leave-room ${mxid} ${roomId}`);
            }
        } catch (e) { /* ignore */ }
    }

    // Leave
    await fetch(`${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/leave`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}'
    });

    // Delete via admin
    await sendAdminCommand(homeserverUrl, token, adminRoomId, userId,
        `!admin rooms delete --force ${roomId}`);
}

async function main() {
    const doDelete = process.argv.includes('--delete');
    const moodleConfig = config.moodleCourses;
    const matrix = config.matrix;
    const homeserverUrl = matrix.homeserverUrl;
    const domain = new URL(homeserverUrl).hostname.replace(/^matrix\./, '');
    const enabledField = moodleConfig.customFields?.enabled || 'matrix_enabled';

    console.log(`Mode: ${doDelete ? '🔴 DELETE' : '🟢 DRY RUN (--delete to execute)'}\n`);

    // 1. Get all courses from Moodle, split into enabled/disabled
    const categories = await moodleCall(moodleConfig, 'core_course_get_categories');
    const includedCatIds = getIncludedCategoryIds(categories, moodleConfig.includeCategories || []);

    const enabledIds = new Set();
    const disabledCourses = []; // courses without matrix_enabled

    for (const catId of includedCatIds) {
        try {
            const result = await moodleCall(moodleConfig, 'core_course_get_courses_by_field', { field: 'category', value: catId });
            for (const c of (result.courses || result)) {
                if (c.id === 1) continue;
                const field = (c.customfields || []).find(f => f.shortname === enabledField);
                if (field && (field.valueraw === 1 || field.valueraw === '1')) {
                    enabledIds.add(c.id);
                } else {
                    disabledCourses.push(c);
                }
            }
        } catch (e) { /* ignore */ }
    }

    console.log(`Courses with matrix_enabled: ${enabledIds.size}`);
    console.log(`Courses without matrix_enabled: ${disabledCourses.length}`);

    // 2. Login to Matrix
    const { access_token: token, user_id: userId } = await matrixLogin(matrix);
    console.log(`Logged in as ${userId}`);

    let adminRoomId = null;
    if (doDelete) {
        adminRoomId = await resolveAlias(homeserverUrl, token, `#admins:${domain}`);
        if (!adminRoomId) throw new Error('Could not resolve #admins room');
    }

    // 3. Check which disabled courses still have a Matrix room
    console.log(`\nChecking ${disabledCourses.length} courses for existing Matrix rooms...`);
    const staleRooms = [];

    for (const course of disabledCourses) {
        const alias = `#moodle_course_${course.id}:${domain}`;
        const roomId = await resolveAlias(homeserverUrl, token, alias);
        if (roomId) {
            staleRooms.push({ courseId: course.id, name: course.fullname, roomId, alias });
            console.log(`  ✗ ${course.fullname} (${alias}) → ${roomId}`);
        }
    }

    // 4. Summary
    console.log(`\n=== ${staleRooms.length} stale rooms found ===`);

    if (staleRooms.length === 0) {
        console.log('✓ Nothing to clean up.');
        return;
    }

    if (!doDelete) {
        console.log(`\n🟢 Dry run. Run with --delete to remove ${staleRooms.length} rooms.`);
        return;
    }

    // 5. Delete
    console.log(`\n🔴 Deleting ${staleRooms.length} rooms...`);
    let deleted = 0;
    for (const r of staleRooms) {
        try {
            console.log(`  Deleting "${r.name}" (${r.roomId})...`);
            await deleteRoom(homeserverUrl, token, adminRoomId, userId, r.roomId);
            deleted++;
            console.log(`    ✓ deleted`);
        } catch (e) {
            console.error(`    ✗ ${e.message}`);
        }
    }
    console.log(`\n✓ Deleted ${deleted}/${staleRooms.length} rooms.`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
