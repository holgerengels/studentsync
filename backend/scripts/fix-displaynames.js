#!/usr/bin/env node
/**
 * Remove 💕 suffix from all Matrix user display names.
 * Uses MongoDB to find all users, then updates via Synapse Admin API
 * (supported by Tuwunel).
 * 
 * Usage:
 *   node scripts/fix-displaynames.js          # Dry run
 *   node scripts/fix-displaynames.js --apply   # Apply changes
 */
const config = require('../src/config');
const mongoose = require('mongoose');

const AS_TOKEN = config.matrix?.asToken || process.env.AS_TOKEN;
if (!AS_TOKEN) {
    console.error('AS_TOKEN not found. Set matrix.asToken in settings.json or AS_TOKEN env var.');
    process.exit(1);
}

async function main() {
    const doApply = process.argv.includes('--apply');
    const matrix = config.matrix;
    const homeserverUrl = matrix.homeserverUrl;
    const domain = new URL(homeserverUrl).hostname.replace(/^matrix\./, '');

    console.log(`Mode: ${doApply ? '🔴 APPLY' : '🟢 DRY RUN (--apply to execute)'}\n`);

    // Connect to MongoDB
    const mongoUri = config.mongodb?.uri || 'mongodb://localhost:27017/synx_logs';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const MatrixModel = mongoose.models.MatrixIdentity || mongoose.model('MatrixIdentity',
        new mongoose.Schema({ login: String, userId: String }, { strict: false }));
    const allUsers = await MatrixModel.find({}).lean();
    console.log(`Found ${allUsers.length} users in MongoDB`);

    // Login as admin
    const loginRes = await fetch(`${homeserverUrl}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'm.login.password',
            identifier: { type: 'm.id.user', user: matrix.adminUsername },
            password: matrix.adminPassword
        })
    });
    if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
    const { access_token: token } = await loginRes.json();
    console.log(`Logged in as admin\n`);

    // Check each user's display name
    const toFix = [];
    for (const user of allUsers) {
        const username = user.login || user.userId;
        const mxid = `@${username}:${domain}`;
        try {
            const profileRes = await fetch(
                `${homeserverUrl}/_matrix/client/v3/profile/${encodeURIComponent(mxid)}/displayname`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (profileRes.ok) {
                const { displayname } = await profileRes.json();
                if (displayname && displayname.includes('💕')) {
                    const cleanName = displayname.replace(/\s*💕\s*/g, '').trim();
                    toFix.push({ mxid, username, displayname, cleanName });
                }
            }
        } catch (e) { /* ignore */ }
    }

    console.log(`${toFix.length} users with 💕 to fix:\n`);

    let fixed = 0;
    for (const { mxid, displayname, cleanName } of toFix) {
        console.log(`  ${displayname} → ${cleanName}`);

        if (doApply) {
            try {
                // Use Synapse Admin API (same as MatrixDomain.changeIdentity)
                const updateUrl = `${homeserverUrl}/_synapse/admin/v2/users/${encodeURIComponent(mxid)}`;
                const res = await fetch(updateUrl, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayname: cleanName })
                });
                if (res.ok) {
                    fixed++;
                } else {
                    console.log(`    ⚠ Failed: ${res.status} ${await res.text()}`);
                }
            } catch (e) {
                console.log(`    ⚠ Error: ${e.message}`);
            }
        }
    }

    if (doApply) {
        console.log(`\n✓ Fixed ${fixed}/${toFix.length} display names.`);
    } else {
        console.log(`\n🟢 Dry run. Run with --apply to fix ${toFix.length} names.`);
    }

    await mongoose.disconnect();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
