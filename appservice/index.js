const express = require('express');
const app = express();
app.use(express.json());

// --- Configuration from environment ---

const HOMESERVER_URL = process.env.HOMESERVER_URL || 'http://tuwunel:8008';
const DOMAIN = process.env.DOMAIN;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const AS_TOKEN = process.env.AS_TOKEN;
const HS_TOKEN = process.env.HS_TOKEN;
const APPSERVICE_HOST = process.env.APPSERVICE_HOST || 'synx-appservice';
const PORT = process.env.PORT || 3002;

if (!DOMAIN || !AS_TOKEN || !HS_TOKEN) {
    console.error('[Appservice] Missing required environment variables: DOMAIN, AS_TOKEN, HS_TOKEN');
    process.exit(1);
}

const BOT_MXID = `@${ADMIN_USER}:${DOMAIN}`;

// --- Matrix API helpers ---

function matrixUrl(path) {
    return `${HOMESERVER_URL}/_matrix/client/v3${path}`;
}

function authHeaders(token = AS_TOKEN) {
    return { 'Authorization': `Bearer ${token}` };
}

function jsonHeaders(token = AS_TOKEN) {
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function matrixGet(path, token = AS_TOKEN) {
    const res = await fetch(matrixUrl(path), { headers: authHeaders(token) });
    if (!res.ok) return null;
    return res.json();
}

async function matrixPost(path, body = {}, token = AS_TOKEN) {
    return fetch(matrixUrl(path), {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify(body)
    });
}

async function matrixPut(path, body, token = AS_TOKEN) {
    return fetch(matrixUrl(path), {
        method: 'PUT',
        headers: jsonHeaders(token),
        body: JSON.stringify(body)
    });
}

async function resolveAlias(alias, token = AS_TOKEN) {
    const data = await matrixGet(`/directory/room/${encodeURIComponent(alias)}`, token);
    return data?.room_id || null;
}

async function getJoinedMembers(roomId, token = AS_TOKEN) {
    const data = await matrixGet(`/rooms/${encodeURIComponent(roomId)}/joined_members`, token);
    return Object.keys(data?.joined || {});
}

const roomDisplayNames = new Map();

function displayName(mxid) {
    return mxid.split(':')[0].substring(1);
}

async function roomName(roomId) {
    if (roomDisplayNames.has(roomId)) return roomDisplayNames.get(roomId);
    try {
        const nameData = await matrixGet(`/rooms/${encodeURIComponent(roomId)}/state/m.room.name`);
        if (nameData?.name) {
            roomDisplayNames.set(roomId, nameData.name);
            return nameData.name;
        }
        const aliasData = await matrixGet(`/rooms/${encodeURIComponent(roomId)}/state/m.room.canonical_alias`);
        if (aliasData?.alias) {
            roomDisplayNames.set(roomId, aliasData.alias);
            return aliasData.alias;
        }
    } catch { }
    roomDisplayNames.set(roomId, roomId);
    return roomId;
}

async function joinUserToRoom(roomId, mxid) {
    return matrixPost(`/join/${encodeURIComponent(roomId)}?user_id=${encodeURIComponent(mxid)}`);
}

async function kickUserFromRoom(roomId, mxid, reason = 'Removed from class space') {
    return matrixPost(`/rooms/${encodeURIComponent(roomId)}/kick`, { user_id: mxid, reason });
}

async function getAdminToken() {
    if (!ADMIN_USER || !ADMIN_PASSWORD) return null;
    const res = await matrixPost('/login', {
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: ADMIN_USER },
        password: ADMIN_PASSWORD
    }, undefined);
    if (!res.ok) return null;
    return (await res.json()).access_token;
}

// --- Teacher cache ---

let teachersSpaceId = null;
let teacherMxids = new Set();
let teachersCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function refreshTeachers() {
    if (Date.now() - teachersCacheTime < CACHE_TTL) return;
    try {
        if (!teachersSpaceId) {
            teachersSpaceId = await resolveAlias(`#teachers:${DOMAIN}`);
            if (!teachersSpaceId) {
                console.warn('[Appservice] Could not resolve #teachers space, will retry');
                return;
            }
            console.log(`[Appservice] Resolved teachers space: ${teachersSpaceId}`);
        }

        const members = await getJoinedMembers(teachersSpaceId);
        teacherMxids = new Set(members);
        teachersCacheTime = Date.now();
        console.log(`[Appservice] Refreshed teacher list: ${teacherMxids.size} teachers`);
    } catch (e) {
        console.error('[Appservice] Failed to refresh teachers:', e.message);
    }
}

// --- Room detection and power level management ---

async function isClassSpace(roomId) {
    try {
        const res = await fetch(
            `${HOMESERVER_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.canonical_alias`,
            { headers: { 'Authorization': `Bearer ${AS_TOKEN}` } }
        );
        if (!res.ok) return false;
        const data = await res.json();
        return (data.canonical_alias || data.alias || '').startsWith('#class_');
    } catch {
        return false;
    }
}

async function setUserPowerLevel(roomId, mxid, level) {
    try {
        const path = `/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels`;
        const powerLevels = await matrixGet(path);
        if (!powerLevels) return;

        powerLevels.users = powerLevels.users || {};
        if (powerLevels.users[mxid] === level) return;

        powerLevels.users[mxid] = level;
        const res = await matrixPut(path, powerLevels);

        if (res.ok) {
            console.log(`[Appservice] Promoted ${await displayName(mxid)} to PL ${level} in ${await roomName(roomId)}`);
        } else {
            console.warn(`[Appservice] Failed to set PL for ${await displayName(mxid)} in ${await roomName(roomId)}: ${await res.text()}`);
        }
    } catch (e) {
        console.error(`[Appservice] Error setting power level for ${mxid}:`, e.message);
    }
}

// --- Child room helpers ---

async function getChildRooms(spaceId) {
    try {
        const stateEvents = await matrixGet(`/rooms/${encodeURIComponent(spaceId)}/state`);
        if (!stateEvents) return [];
        return stateEvents
            .filter(e => e.type === 'm.space.child' && e.content?.via)
            .map(e => e.state_key);
    } catch (e) {
        console.error('[Appservice] Failed to get child rooms:', e.message);
        return [];
    }
}

async function getStudents(spaceId) {
    const members = await getJoinedMembers(spaceId);
    return members.filter(m => m !== BOT_MXID && !teacherMxids.has(m));
}

async function joinStudentsToRoom(spaceId, roomId) {
    const students = await getStudents(spaceId);
    const alreadyInRoom = new Set(await getJoinedMembers(roomId));
    const toJoin = students.filter(m => !alreadyInRoom.has(m));
    if (toJoin.length === 0) return 0;

    let joined = 0;
    for (const mxid of toJoin) {
        try {
            const res = await joinUserToRoom(roomId, mxid);
            if (res.ok) {
                joined++;
            } else if (joined === 0) {
                console.warn(`[Appservice] Join failed for ${mxid}: ${await res.text()}`);
            }
        } catch (e) {
            // Ignore individual errors
        }
    }
    return joined;
}

async function syncStudentToChildRooms(spaceId, mxid, action) {
    try {
        const childRooms = await getChildRooms(spaceId);
        if (childRooms.length === 0) return;

        let count = 0;
        for (const roomId of childRooms) {
            try {
                const res = action === 'join'
                    ? await joinUserToRoom(roomId, mxid)
                    : await kickUserFromRoom(roomId, mxid);
                if (res.ok) count++;
            } catch (e) {
                // Ignore individual room errors
            }
        }

        console.log(`[Appservice] Synced student ${await displayName(mxid)}: ${action} ${count}/${childRooms.length} child rooms`);
    } catch (e) {
        console.error(`[Appservice] Failed to sync student ${mxid}:`, e.message);
    }
}

// --- Event handler ---

async function handleEvent(event) {
    // 1. Member events in class spaces
    if (event.type === 'm.room.member') {
        const mxid = event.state_key;
        const roomId = event.room_id;

        if (!await isClassSpace(roomId)) return;

        await refreshTeachers();
        const membership = event.content?.membership;

        if (membership === 'join') {
            if (teacherMxids.has(mxid)) {
                // Teacher joined → promote to moderator in the space only
                await setUserPowerLevel(roomId, mxid, 50);
            } else {
                // Student joined → auto-join to all existing child rooms
                console.log(`[Appservice] Student ${await displayName(mxid)} joined class space ${await roomName(roomId)}`);
                await syncStudentToChildRooms(roomId, mxid, 'join');
            }
            return;
        }

        if (membership === 'leave' || membership === 'ban') {
            if (teacherMxids.has(mxid)) return; // Teachers manage their own rooms

            // Student left or was removed → kick from all child rooms
            console.log(`[Appservice] Student ${await displayName(mxid)} left class space ${await roomName(roomId)}`);
            await syncStudentToChildRooms(roomId, mxid, 'leave');
            return;
        }
    }

    // 2. Auto-join: when a new room is added to a class space, join all students
    if (event.type === 'm.space.child' && event.content?.via) {
        const spaceId = event.room_id;
        const childRoomId = event.state_key;

        if (!await isClassSpace(spaceId)) return;

        await refreshTeachers();
        console.log(`[Appservice] New room ${await roomName(childRoomId)} added to class space ${await roomName(spaceId)}`);

        // Bot must join the child room first to be able to modify state
        try {
            const joinRes = await matrixPost(`/join/${encodeURIComponent(childRoomId)}`);
            if (!joinRes.ok) {
                console.warn(`[Appservice] Bot failed to join ${childRoomId}: ${await joinRes.text()}`);
            }
        } catch (e) {
            console.warn(`[Appservice] Bot join error for ${childRoomId}:`, e.message);
        }

        // Set join rule to 'knock' so other teachers must request to join
        try {
            const joinRulePath = `/rooms/${encodeURIComponent(childRoomId)}/state/m.room.join_rules`;
            const res = await matrixPut(joinRulePath, { join_rule: 'knock' });
            if (res.ok) {
                console.log(`[Appservice] Set join rule to 'knock' for ${await roomName(childRoomId)}`);
            } else {
                console.warn(`[Appservice] Failed to set join rule for ${childRoomId}: ${await res.text()}`);
            }
        } catch (e) {
            console.warn(`[Appservice] Error setting join rule for ${childRoomId}:`, e.message);
        }

        try {
            const joined = await joinStudentsToRoom(spaceId, childRoomId);
            console.log(`[Appservice] Auto-joined ${joined} students to ${await roomName(childRoomId)}`);
        } catch (e) {
            console.error('[Appservice] Auto-join failed:', e.message);
        }
    }
}

// --- Startup reconciliation ---

async function reconcileClassSpaces() {
    try {
        await refreshTeachers();

        // Find all class spaces from public room list
        let allRooms = [];
        let nextBatch = null;
        do {
            const path = nextBatch
                ? `/publicRooms?since=${encodeURIComponent(nextBatch)}`
                : '/publicRooms';
            const data = await matrixGet(path);
            if (!data) break;
            allRooms = allRooms.concat(data.chunk || []);
            nextBatch = data.next_batch || null;
        } while (nextBatch);

        const classSpaces = allRooms.filter(r => r.canonical_alias?.startsWith('#class_'));
        console.log(`[Appservice] Reconciling ${classSpaces.length} class spaces...`);

        let totalJoined = 0;
        for (const space of classSpaces) {
            try {
                const childRooms = await getChildRooms(space.room_id);
                for (const roomId of childRooms) {
                    totalJoined += await joinStudentsToRoom(space.room_id, roomId);
                }
            } catch (e) {
                console.warn(`[Appservice] Reconcile failed for ${space.canonical_alias}: ${e.message}`);
            }
        }

        console.log(`[Appservice] Reconciliation complete: ${totalJoined} students joined`);
    } catch (e) {
        console.error('[Appservice] Reconciliation failed:', e.message);
    }
}

// --- Self-registration at Tuwunel via #admins room ---

async function ensureRegistered() {
    if (!ADMIN_USER || !ADMIN_PASSWORD) {
        console.warn('[Appservice] No ADMIN_USER/ADMIN_PASSWORD set, skipping self-registration');
        return;
    }

    try {
        const adminToken = await getAdminToken();
        if (!adminToken) throw new Error('Admin login failed');

        const adminRoomId = await resolveAlias(`#admins:${DOMAIN}`, adminToken);
        if (!adminRoomId) throw new Error('Could not resolve #admins room');

        // Check if already registered, unregister first to pick up config changes
        const listResponse = await sendAndReadResponse(adminRoomId, adminToken,
            '!admin appservices list');

        if (listResponse.includes('synx-appservice')) {
            console.log('[Appservice] Already registered, re-registering to update config...');
            const unregResponse = await sendAndReadResponse(adminRoomId, adminToken,
                '!admin appservices unregister synx-appservice');
            console.log('[Appservice] Unregister response:', unregResponse);
        }

        // Register with user namespace so Tuwunel forwards join events
        const senderLocalpart = ADMIN_USER.replace(/^@/, '').split(':')[0];
        const regexDomain = DOMAIN.replace(/\./g, '\\.');
        const yaml = [
            'id: synx-appservice',
            `url: "http://${APPSERVICE_HOST}:${PORT}"`,
            `as_token: "${AS_TOKEN}"`,
            `hs_token: "${HS_TOKEN}"`,
            `sender_localpart: "${senderLocalpart}"`,
            'namespaces:',
            '  users:',
            '    - exclusive: false',
            `      regex: '@.*:${regexDomain}'`,
            '  rooms: []',
            '  aliases: []'
        ].join('\n');

        const registerResponse = await sendAndReadResponse(adminRoomId, adminToken,
            `!admin appservices register\n\`\`\`yaml\n${yaml}\n\`\`\``);

        console.log('[Appservice] Registration response:', registerResponse);

        // Join bot to all class spaces so we receive events
        await joinBotToSpaces(adminToken);
    } catch (e) {
        console.error('[Appservice] Self-registration failed:', e.message);
        console.error('[Appservice] Will retry on next restart');
    }
}

async function joinBotToSpaces(adminToken) {
    try {
        // Get all public rooms (paginate)
        let allRooms = [];
        let nextBatch = null;
        do {
            const path = nextBatch
                ? `/publicRooms?since=${encodeURIComponent(nextBatch)}`
                : '/publicRooms';
            const data = await matrixGet(path, adminToken);
            if (!data) break;
            allRooms = allRooms.concat(data.chunk || []);
            nextBatch = data.next_batch || null;
        } while (nextBatch);

        // Filter class spaces and teachers space
        const targetRooms = allRooms.filter(r =>
            r.canonical_alias?.startsWith('#class_') ||
            r.canonical_alias === `#teachers:${DOMAIN}`
        );

        // Check which rooms bot is already in
        let alreadyJoined = new Set();
        try {
            const data = await matrixGet(`/joined_rooms?user_id=${encodeURIComponent(BOT_MXID)}`);
            alreadyJoined = new Set(data?.joined_rooms || []);
        } catch (e) {
            // Ignore
        }

        const toJoin = targetRooms.filter(r => !alreadyJoined.has(r.room_id));
        console.log(`[Appservice] Joining ${BOT_MXID} to ${toJoin.length} spaces (${alreadyJoined.size} already joined)...`);

        let joined = 0;
        for (const room of toJoin) {
            try {
                const res = await matrixPost(`/join/${encodeURIComponent(room.room_id)}`, {}, adminToken);
                if (res.ok) {
                    joined++;
                } else {
                    console.warn(`[Appservice] Join failed for ${room.canonical_alias}: ${await res.text()}`);
                }
            } catch (e) {
                // Ignore individual errors
            }
        }

        console.log(`[Appservice] Bot joined ${joined}/${toJoin.length} new spaces`);
    } catch (e) {
        console.error('[Appservice] Failed to join bot to spaces:', e.message);
    }
}

async function sendAndReadResponse(adminRoomId, token, message) {
    // Identify our own user to filter out our messages from responses
    let senderMxid = null;
    try {
        const data = await matrixGet('/account/whoami', token);
        senderMxid = data?.user_id || null;
    } catch (e) { /* ignore */ }

    // Send command
    const txnId = `${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const sendRes = await matrixPut(
        `/rooms/${encodeURIComponent(adminRoomId)}/send/m.room.message/${txnId}`,
        { msgtype: 'm.text', body: message },
        token
    );
    if (!sendRes.ok) {
        throw new Error(`Failed to send admin command: ${await sendRes.text()}`);
    }

    // Wait for response
    await new Promise(r => setTimeout(r, 1500));

    // Read response — find the first message NOT from ourselves (i.e. from the server bot)
    const msgs = await matrixGet(
        `/rooms/${encodeURIComponent(adminRoomId)}/messages?dir=b&limit=3`,
        token
    );
    const botMsg = (msgs?.chunk || []).find(c =>
        c.sender && c.sender !== senderMxid && c.content?.body
    );
    return botMsg?.content?.body || '';
}

// --- HTTP endpoints ---

async function handleTransaction(req, res) {
    const tokenFromQuery = req.query.access_token;
    const tokenFromHeader = (req.headers.authorization || '').replace('Bearer ', '');
    const token = tokenFromQuery || tokenFromHeader;

    if (token !== HS_TOKEN) {
        console.warn(`[Appservice] Rejected transaction: invalid token (query=${!!tokenFromQuery}, header=${!!tokenFromHeader})`);
        return res.status(403).json({ errcode: 'M_FORBIDDEN' });
    }

    console.log(`[Appservice] Received transaction ${req.params.txnId} with ${(req.body.events || []).length} events`);
    for (const event of req.body.events || []) {
        console.log(`[Appservice] Event: ${event.type} from ${await displayName(event.sender)} in ${await roomName(event.room_id)}`);
        try {
            await handleEvent(event);
        } catch (e) {
            console.error('[Appservice] Error handling event:', e.message);
        }
    }

    res.json({});
}

app.put('/transactions/:txnId', handleTransaction);
app.put('/_matrix/app/v1/transactions/:txnId', handleTransaction);

const handleUserQuery = (req, res) => res.status(404).json({});
const handleRoomQuery = (req, res) => res.status(404).json({});

app.get('/users/:userId', handleUserQuery);
app.get('/_matrix/app/v1/users/:userId', handleUserQuery);
app.get('/rooms/:roomAlias', handleRoomQuery);
app.get('/_matrix/app/v1/rooms/:roomAlias', handleRoomQuery);

// --- Start ---

app.listen(PORT, async () => {
    console.log(`[Appservice] Listening on port ${PORT}`);
    console.log(`[Appservice] Homeserver: ${HOMESERVER_URL}`);
    console.log(`[Appservice] Domain: ${DOMAIN}`);

    // Wait a bit for Tuwunel to be ready (Docker depends_on only waits for container start)
    await new Promise(r => setTimeout(r, 3000));
    await ensureRegistered();
    await reconcileClassSpaces();

    // Periodically check for new spaces and join the bot
    setInterval(async () => {
        try {
            const token = await getAdminToken();
            if (token) await joinBotToSpaces(token);
        } catch (e) {
            console.error('[Appservice] Periodic join check failed:', e.message);
        }
    }, 2 * 60 * 1000); // Every 2 minutes
});

process.on('SIGTERM', () => {
    console.log('[Appservice] SIGTERM received, shutting down');
    process.exit(0);
});
