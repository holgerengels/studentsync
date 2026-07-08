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

// --- Teacher cache (via Matrix API, no MongoDB) ---

let teachersSpaceId = null;
let teacherMxids = new Set();
let teachersCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function refreshTeachers() {
    if (Date.now() - teachersCacheTime < CACHE_TTL) return;
    try {
        // Resolve teachers space ID (once)
        if (!teachersSpaceId) {
            const alias = encodeURIComponent(`#teachers:${DOMAIN}`);
            const res = await fetch(
                `${HOMESERVER_URL}/_matrix/client/v3/directory/room/${alias}`,
                { headers: { 'Authorization': `Bearer ${AS_TOKEN}` } }
            );
            if (res.ok) {
                teachersSpaceId = (await res.json()).room_id;
                console.log(`[Appservice] Resolved teachers space: ${teachersSpaceId}`);
            } else {
                console.warn('[Appservice] Could not resolve #teachers space, will retry');
                return;
            }
        }

        // Load members of teachers space
        const res = await fetch(
            `${HOMESERVER_URL}/_matrix/client/v3/rooms/${encodeURIComponent(teachersSpaceId)}/joined_members`,
            { headers: { 'Authorization': `Bearer ${AS_TOKEN}` } }
        );
        if (res.ok) {
            const data = await res.json();
            teacherMxids = new Set(Object.keys(data.joined || {}));
            teachersCacheTime = Date.now();
            console.log(`[Appservice] Refreshed teacher list: ${teacherMxids.size} teachers`);
        }
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
        return (data.alias || '').startsWith('#class_');
    } catch {
        return false;
    }
}

async function setUserPowerLevel(roomId, mxid, level) {
    try {
        const url = `${HOMESERVER_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels`;
        const getRes = await fetch(url, {
            headers: { 'Authorization': `Bearer ${AS_TOKEN}` }
        });
        if (!getRes.ok) return;

        const powerLevels = await getRes.json();
        powerLevels.users = powerLevels.users || {};

        // Only update if needed
        if (powerLevels.users[mxid] === level) return;

        powerLevels.users[mxid] = level;
        const putRes = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${AS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(powerLevels)
        });

        if (putRes.ok) {
            console.log(`[Appservice] Promoted ${mxid} to PL ${level} in ${roomId}`);
        } else {
            console.warn(`[Appservice] Failed to set PL for ${mxid}: ${await putRes.text()}`);
        }
    } catch (e) {
        console.error(`[Appservice] Error setting power level for ${mxid}:`, e.message);
    }
}

// --- Event handler ---

async function handleEvent(event) {
    if (event.type !== 'm.room.member') return;
    if (event.content?.membership !== 'join') return;

    const mxid = event.state_key;
    const roomId = event.room_id;

    // Only act on class spaces
    if (!await isClassSpace(roomId)) return;

    // Only promote teachers
    await refreshTeachers();
    if (!teacherMxids.has(mxid)) return;

    await setUserPowerLevel(roomId, mxid, 50);
}

// --- Self-registration at Tuwunel via #admins room ---

async function ensureRegistered() {
    if (!ADMIN_USER || !ADMIN_PASSWORD) {
        console.warn('[Appservice] No ADMIN_USER/ADMIN_PASSWORD set, skipping self-registration');
        return;
    }

    try {
        // 1. Admin login
        const loginRes = await fetch(`${HOMESERVER_URL}/_matrix/client/v3/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'm.login.password',
                identifier: { type: 'm.id.user', user: ADMIN_USER },
                password: ADMIN_PASSWORD
            })
        });
        if (!loginRes.ok) {
            throw new Error(`Admin login failed: ${loginRes.status} ${loginRes.statusText}`);
        }
        const adminToken = (await loginRes.json()).access_token;

        // 2. Resolve #admins room
        const alias = encodeURIComponent(`#admins:${DOMAIN}`);
        const resolveRes = await fetch(
            `${HOMESERVER_URL}/_matrix/client/v3/directory/room/${alias}`,
            { headers: { 'Authorization': `Bearer ${adminToken}` } }
        );
        if (!resolveRes.ok) {
            throw new Error('Could not resolve #admins room');
        }
        const adminRoomId = (await resolveRes.json()).room_id;

        // 3. Check if already registered, unregister first to pick up config changes
        const listResponse = await sendAndReadResponse(adminRoomId, adminToken,
            '!admin appservices list');

        if (listResponse.includes('synx-appservice')) {
            console.log('[Appservice] Already registered, re-registering to update config...');
            const unregResponse = await sendAndReadResponse(adminRoomId, adminToken,
                '!admin appservices unregister synx-appservice');
            console.log('[Appservice] Unregister response:', unregResponse);
        }

        // 4. Register with user namespace so Tuwunel forwards join events
        const escapedDomain = DOMAIN.replace(/\./g, '\\\\.');
        const yaml = [
            'id: synx-appservice',
            `url: http://${APPSERVICE_HOST}:${PORT}`,
            `as_token: ${AS_TOKEN}`,
            `hs_token: ${HS_TOKEN}`,
            'sender_localpart: synx-bot',
            'namespaces:',
            '  users:',
            `    - exclusive: false`,
            `      regex: "@.*:${escapedDomain}"`,
            '  rooms: []',
            '  aliases: []'
        ].join('\n');

        const registerResponse = await sendAndReadResponse(adminRoomId, adminToken,
            `!admin appservices register\n\`\`\`yaml\n${yaml}\n\`\`\``);

        console.log('[Appservice] Registration response:', registerResponse);

        // 5. Join synx-bot to all class spaces so we receive events
        await joinBotToSpaces(adminToken);
    } catch (e) {
        console.error('[Appservice] Self-registration failed:', e.message);
        console.error('[Appservice] Will retry on next restart');
    }
}

async function joinBotToSpaces(adminToken) {
    const botMxid = `@synx-bot:${DOMAIN}`;
    try {
        // 1. Ensure synx-bot user is registered
        try {
            await fetch(`${HOMESERVER_URL}/_matrix/client/v3/register`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'm.login.application_service',
                    username: 'synx-bot'
                })
            });
        } catch (e) {
            // Ignore - user may already exist
        }

        // 2. Get all public rooms (paginate)
        let allRooms = [];
        let nextBatch = null;
        do {
            const url = nextBatch
                ? `${HOMESERVER_URL}/_matrix/client/v3/publicRooms?since=${encodeURIComponent(nextBatch)}`
                : `${HOMESERVER_URL}/_matrix/client/v3/publicRooms`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            if (!res.ok) break;
            const data = await res.json();
            allRooms = allRooms.concat(data.chunk || []);
            nextBatch = data.next_batch || null;
        } while (nextBatch);

        // 3. Filter class spaces and teachers space
        const targetRooms = allRooms.filter(r =>
            (r.canonical_alias && r.canonical_alias.startsWith('#class_')) ||
            (r.canonical_alias && r.canonical_alias === `#teachers:${DOMAIN}`)
        );

        // 4. Check which rooms synx-bot is already in
        let alreadyJoined = new Set();
        try {
            const joinedRes = await fetch(
                `${HOMESERVER_URL}/_matrix/client/v3/joined_rooms?user_id=${encodeURIComponent(botMxid)}`,
                { headers: { 'Authorization': `Bearer ${AS_TOKEN}` } }
            );
            if (joinedRes.ok) {
                const data = await joinedRes.json();
                alreadyJoined = new Set(data.joined_rooms || []);
            }
        } catch (e) {
            // Ignore
        }

        const toJoin = targetRooms.filter(r => !alreadyJoined.has(r.room_id));
        console.log(`[Appservice] Joining synx-bot to ${toJoin.length} spaces (${alreadyJoined.size} already joined)...`);

        // 5. Invite + join for each room
        let joined = 0;
        for (const room of toJoin) {
            try {
                // Admin invites synx-bot
                const inviteRes = await fetch(
                    `${HOMESERVER_URL}/_matrix/client/v3/rooms/${encodeURIComponent(room.room_id)}/invite`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${adminToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ user_id: botMxid })
                    }
                );

                if (!inviteRes.ok) {
                    const errText = await inviteRes.text();
                    console.warn(`[Appservice] Invite failed for ${room.canonical_alias}: ${errText}`);
                    continue;
                }

                // synx-bot accepts via AS_TOKEN
                const joinRes = await fetch(
                    `${HOMESERVER_URL}/_matrix/client/v3/join/${encodeURIComponent(room.room_id)}?user_id=${encodeURIComponent(botMxid)}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${AS_TOKEN}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({})
                    }
                );

                if (joinRes.ok) {
                    joined++;
                } else {
                    console.warn(`[Appservice] Join failed for ${room.canonical_alias}: ${await joinRes.text()}`);
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
    // Send command
    const txnId = `${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const sendRes = await fetch(
        `${HOMESERVER_URL}/_matrix/client/v3/rooms/${encodeURIComponent(adminRoomId)}/send/m.room.message/${txnId}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ msgtype: 'm.text', body: message })
        }
    );
    if (!sendRes.ok) {
        throw new Error(`Failed to send admin command: ${await sendRes.text()}`);
    }

    // Wait for response
    await new Promise(r => setTimeout(r, 1500));

    // Read response
    const msgRes = await fetch(
        `${HOMESERVER_URL}/_matrix/client/v3/rooms/${encodeURIComponent(adminRoomId)}/messages?dir=b&limit=3`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!msgRes.ok) return '';

    const msgs = await msgRes.json();
    // Find the bot's response (sender contains 'conduit')
    const botMsg = (msgs.chunk || []).find(c =>
        c.sender && c.sender.includes('conduit') && c.content?.body
    );
    return botMsg?.content?.body || '';
}

// --- HTTP endpoints ---

app.put('/transactions/:txnId', async (req, res) => {
    if (req.query.access_token !== HS_TOKEN) {
        return res.status(403).json({ errcode: 'M_FORBIDDEN' });
    }

    console.log(`[Appservice] Received transaction ${req.params.txnId} with ${(req.body.events || []).length} events`);
    for (const event of req.body.events || []) {
        console.log(`[Appservice] Event: ${event.type} from ${event.sender} in ${event.room_id}`);
        try {
            await handleEvent(event);
        } catch (e) {
            console.error('[Appservice] Error handling event:', e.message);
        }
    }

    res.json({});
});

// Required by Matrix spec (Tuwunel queries these)
app.get('/users/:userId', (req, res) => res.status(404).json({}));
app.get('/rooms/:roomAlias', (req, res) => res.status(404).json({}));

// --- Start ---

async function getAdminToken() {
    if (!ADMIN_USER || !ADMIN_PASSWORD) return null;
    const loginRes = await fetch(`${HOMESERVER_URL}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'm.login.password',
            identifier: { type: 'm.id.user', user: ADMIN_USER },
            password: ADMIN_PASSWORD
        })
    });
    if (!loginRes.ok) return null;
    return (await loginRes.json()).access_token;
}

app.listen(PORT, async () => {
    console.log(`[Appservice] Listening on port ${PORT}`);
    console.log(`[Appservice] Homeserver: ${HOMESERVER_URL}`);
    console.log(`[Appservice] Domain: ${DOMAIN}`);

    // Wait a bit for Tuwunel to be ready (Docker depends_on only waits for container start)
    await new Promise(r => setTimeout(r, 3000));
    await ensureRegistered();

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
