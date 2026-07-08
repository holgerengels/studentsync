const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');
const { isDevMode, limitInDevMode } = require('../../utils/devMode');
const config = require('../../config');
const mongoose = require('mongoose');

const classSpaceSchema = new mongoose.Schema({
    className: { type: String, required: true, unique: true },
    spaceId: { type: String, required: true }
});

const ClassSpaceModel = mongoose.models.ClassSpace || mongoose.model('ClassSpace', classSpaceSchema);

class MatrixCreateClassRoomsTask extends Task {
    constructor() {
        super('matrix-create-classrooms');
    }

    async execute(parameters = {}) {
        const matrix = getDomain('matrix');
        const matrixTeacher = getDomain('matrix-teacher');
        const schulkonsole = getDomain('schulkonsole');

        if (!matrix || !schulkonsole) {
            throw new Error('Required domains (matrix or schulkonsole) are not available.');
        }

        const devMode = isDevMode();
        const token = await matrix.ensureAdminToken();
        const homeserverUrl = matrix.homeserverUrl;
        const homeserverDomain = matrix.homeserverDomainName;

        // Resolve admin room ID for Conduit/Tuwunel fallback
        let adminRoomId = null;
        try {
            const adminAlias = `#admins:${homeserverDomain}`;
            const resolveUrl = `${homeserverUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(adminAlias)}`;
            const resolveRes = await fetch(resolveUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resolveRes.ok) {
                const data = await resolveRes.json();
                adminRoomId = data.room_id;
            }
        } catch (e) {
            // Ignore
        }

        // Ensure teachers space exists (used as allow-condition for knock_restricted)
        const teachersAliasLocalpart = 'teachers';
        const teachersFullAlias = `#${teachersAliasLocalpart}:${homeserverDomain}`;
        let teachersSpaceId = null;

        try {
            const resolveUrl = `${homeserverUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(teachersFullAlias)}`;
            const resolveRes = await fetch(resolveUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resolveRes.ok) {
                teachersSpaceId = (await resolveRes.json()).room_id;
            }
        } catch (e) {
            // Ignore
        }

        if (!teachersSpaceId) {
            try {
                const createRes = await fetch(`${homeserverUrl}/_matrix/client/v3/createRoom`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: 'Kollegium',
                        topic: 'Lehrer-Space',
                        visibility: 'private',
                        preset: 'private_chat',
                        room_alias_name: teachersAliasLocalpart,
                        creation_content: { type: 'm.space' }
                    })
                });
                if (createRes.ok) {
                    teachersSpaceId = (await createRes.json()).room_id;
                } else {
                    console.warn(`[MatrixCreateClassRoomsTask] Failed to create teachers space: ${await createRes.text()}`);
                }
            } catch (e) {
                console.warn(`[MatrixCreateClassRoomsTask] Error creating teachers space: ${e.message}`);
            }
        }

        const joinUserToRoom = async (mxid, roomId) => {
            let lastErrorText = 'Unknown error';

            // 1. Try Synapse Admin Join API first
            try {
                const synapseJoinUrl = `${homeserverUrl}/_synapse/admin/v1/join/${encodeURIComponent(mxid)}`;
                const joinRes = await fetch(synapseJoinUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ room_id_or_alias: roomId })
                });
                if (joinRes.ok) {
                    return { success: true };
                }
                lastErrorText = await joinRes.text();
            } catch (err) {
                lastErrorText = err.message;
            }

            // 2. Fallback for Conduit (Tuwunel)
            try {
                const inviteUrl = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`;
                await fetch(inviteUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ user_id: mxid })
                });
            } catch (e) {
                // Ignore invite error
            }

            if (adminRoomId) {
                try {
                    const cmd = `!admin users force-join-room ${mxid} ${roomId}`;
                    const txnId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
                    const sendUrl = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(adminRoomId)}/send/m.room.message/${txnId}`;
                    const sendRes = await fetch(sendUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            msgtype: 'm.text',
                            body: cmd
                        })
                    });
                    if (sendRes.ok) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        return { success: true };
                    }
                    lastErrorText = `Conduit admin command send failed: ${await sendRes.text()}`;
                } catch (e) {
                    lastErrorText = `Conduit admin command error: ${e.message}`;
                }
            }

            return { success: false, error: lastErrorText };
        };

        const getJoinedMembers = async (roomId) => {
            try {
                const membersUrl = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/joined_members`;
                const res = await fetch(membersUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    return Object.keys(data.joined || {});
                }
            } catch (err) {
                console.warn(`[MatrixCreateClassRoomsTask] Error getting joined members for space ${roomId}: ${err.message}`);
            }
            return [];
        };

        const kickUserFromRoom = async (mxid, roomId) => {
            try {
                const kickUrl = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/kick`;
                const kickRes = await fetch(kickUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: mxid,
                        reason: 'User left the class'
                    })
                });
                if (kickRes.ok) {
                    return true;
                }
                console.warn(`[MatrixCreateClassRoomsTask] Failed to kick user ${mxid} from space ${roomId}: ${await kickRes.text()}`);
            } catch (err) {
                console.warn(`[MatrixCreateClassRoomsTask] Error kicking user ${mxid} from space ${roomId}: ${err.message}`);
            }
            return false;
        };

        const errors = [];

        // 0. One-time migration: delete old classroom rooms and drop the old collection
        const roomsMigrated = await this.migrateOldClassrooms(homeserverUrl, token, errors);

        // Ensure teacher mapping is populated
        if (matrixTeacher) {
            await matrixTeacher.getIdentities();
        }

        // Join all teachers to the teachers space
        if (teachersSpaceId && matrixTeacher) {
            const allTeachers = await matrixTeacher.getIdentities();
            const { items: teachersToProcess } = limitInDevMode(allTeachers);
            for (const teacher of teachersToProcess) {
                const login = teacher.login || teacher.userId;
                const tMxid = `@${login}:${homeserverDomain}`;
                try {
                    await joinUserToRoom(tMxid, teachersSpaceId);
                } catch (e) {
                    errors.push(`Failed to join teacher ${tMxid} to teachers space: ${e.message}`);
                }
            }
        }

        // 1. Get all students and group by class
        const students = await schulkonsole.getIdentities();
        const classesMap = {}; // clazz -> students array
        const activeClasses = new Set();

        // Build set of all student MXIDs (used to distinguish students from teachers when kicking)
        const allStudentMxids = new Set();

        for (const s of students) {
            allStudentMxids.add(`@${s.userId}:${homeserverDomain}`);
            if (s.clazz) {
                const normalizedClass = s.clazz.toUpperCase();
                activeClasses.add(normalizedClass);
                if (!classesMap[normalizedClass]) {
                    classesMap[normalizedClass] = [];
                }
                classesMap[normalizedClass].push(s);
            }
        }

        // 2. Deprovision (delete) spaces for classes that no longer exist
        const spacesDeleted = [];

        try {
            const existingSpaces = await ClassSpaceModel.find({}).lean();
            const spacesToDelete = existingSpaces.filter(s => !activeClasses.has(s.className.toUpperCase()));

            // Limit deletions in DevMode
            const { items: deletionsToProcess } = limitInDevMode(spacesToDelete);

            for (const space of deletionsToProcess) {
                try {
                    // Try Synapse Delete Room Admin API
                    const deleteUrl = `${homeserverUrl}/_synapse/admin/v1/rooms/${encodeURIComponent(space.spaceId)}`;
                    const deleteRes = await fetch(deleteUrl, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            block: true,
                            purge: true
                        })
                    });

                    // Even if API returns 404 (e.g. not fully supported by Tuwunel), we proceed to clear MongoDB
                    if (!deleteRes.ok && deleteRes.status !== 404) {
                        const errText = await deleteRes.text();
                        console.warn(`[MatrixCreateClassRoomsTask] Failed to delete space ${space.spaceId} on server: ${errText}`);
                    }

                    await ClassSpaceModel.deleteOne({ _id: space._id });
                    spacesDeleted.push(space.className);
                } catch (err) {
                    errors.push(`Failed to delete obsolete space for ${space.className}: ${err.message}`);
                }
            }
        } catch (dbErr) {
            errors.push(`Database error checking obsolete spaces: ${dbErr.message}`);
        }

        // 3. Resolve class teachers
        const configClassTeachers = config.classTeachers || config.matrix?.classTeachers || {};
        const untisClassTeachers = await this.getUntisClassTeachers();
        const classTeachers = { ...untisClassTeachers, ...configClassTeachers };

        // 4. Process active classes (respect DevMode limit)
        const classNames = Array.from(activeClasses).sort();
        const { items: classesToProcess } = limitInDevMode(classNames);

        const spacesCreated = [];
        let usersJoinedCount = 0;
        let usersKickedCount = 0;

        for (const className of classesToProcess) {
            try {
                const aliasLocalpart = `class_${className.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                const fullAlias = `#${aliasLocalpart}:${homeserverDomain}`;

                // Check if space exists by resolving alias
                let spaceId = null;
                try {
                    const resolveUrl = `${homeserverUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(fullAlias)}`;
                    const resolveRes = await fetch(resolveUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (resolveRes.ok) {
                        const data = await resolveRes.json();
                        spaceId = data.room_id;
                    }
                } catch (e) {
                    // Ignore resolution errors
                }

                // Create space if not existing
                if (!spaceId) {
                    const createUrl = `${homeserverUrl}/_matrix/client/v3/createRoom`;
                    const createRes = await fetch(createUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: className,
                            topic: `Klassen-Space ${className}`,
                            visibility: 'public',
                            room_alias_name: aliasLocalpart,
                            creation_content: {
                                type: 'm.space'
                            },
                            initial_state: [
                                {
                                    type: 'm.room.join_rules',
                                    state_key: '',
                                    content: {
                                        join_rule: 'knock_restricted',
                                        allow: teachersSpaceId ? [{
                                            type: 'm.room_membership',
                                            room_id: teachersSpaceId
                                        }] : []
                                    }
                                }
                            ],
                            power_level_content_override: {
                                events: {
                                    'm.space.child': 50
                                }
                            }
                        })
                    });

                    if (!createRes.ok) {
                        const errText = await createRes.text();
                        throw new Error(`Failed to create space for ${className}: ${errText}`);
                    }

                    const createData = await createRes.json();
                    spaceId = createData.room_id;
                    spacesCreated.push(className);
                }

                // Ensure existing spaces have correct join rules and visibility
                if (teachersSpaceId) {
                    try {
                        const joinRulesUrl = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(spaceId)}/state/m.room.join_rules`;
                        await fetch(joinRulesUrl, {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                join_rule: 'knock_restricted',
                                allow: [{
                                    type: 'm.room_membership',
                                    room_id: teachersSpaceId
                                }]
                            })
                        });
                    } catch (e) {
                        // Ignore
                    }
                }

                try {
                    const visibilityUrl = `${homeserverUrl}/_matrix/client/v3/directory/list/room/${encodeURIComponent(spaceId)}`;
                    await fetch(visibilityUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ visibility: 'public' })
                    });
                } catch (e) {
                    // Ignore
                }

                // Save or update in MongoDB
                await ClassSpaceModel.updateOne(
                    { className: className.toUpperCase() },
                    {
                        $set: {
                            className: className.toUpperCase(),
                            spaceId: spaceId
                        }
                    },
                    { upsert: true }
                );

                // Set class teacher power level to 50 (moderator)
                const teacherInitials = classTeachers[className];
                let teacherMxid = null;
                if (teacherInitials && matrixTeacher) {
                    const teacherLogin = matrixTeacher.initialsToLogin.get(teacherInitials.toLowerCase());
                    if (teacherLogin) {
                        teacherMxid = `@${teacherLogin}:${homeserverDomain}`;
                        await this.setUserPowerLevel(homeserverUrl, token, spaceId, teacherMxid, 50);
                    }
                }

                // Get current joined members in the space
                const joinedMembers = await getJoinedMembers(spaceId);

                // Build set of target user MXIDs (students + class teacher)
                const targetMxids = new Set();
                const classStudents = classesMap[className] || [];
                for (const student of classStudents) {
                    targetMxids.add(`@${student.userId}:${homeserverDomain}`);
                }
                if (teacherMxid) {
                    targetMxids.add(teacherMxid);
                }

                // Teachers are NOT force-joined here. They can self-join via knock_restricted
                // (requires membership in the teachers space). The Matrix Appservice
                // auto-promotes them to moderator (PL 50) on join.

                // 1. Kick students who left the class (but never kick teachers who joined manually)
                for (const joinedUser of joinedMembers) {
                    const adminMxid = `@${matrix.adminUsername}:${homeserverDomain}`;
                    if (joinedUser !== adminMxid && !targetMxids.has(joinedUser) && allStudentMxids.has(joinedUser)) {
                        try {
                            const kickSuccess = await kickUserFromRoom(joinedUser, spaceId);
                            if (kickSuccess) {
                                usersKickedCount++;
                            }
                        } catch (err) {
                            errors.push(`Failed to kick user ${joinedUser} from ${className}: ${err.message}`);
                        }
                    }
                }

                // 2. Join members who should be in the space but are not yet
                for (const targetMxid of targetMxids) {
                    if (!joinedMembers.includes(targetMxid)) {
                        try {
                            const joinResult = await joinUserToRoom(targetMxid, spaceId);
                            if (joinResult.success) {
                                usersJoinedCount++;
                            } else {
                                errors.push(`Failed to join user ${targetMxid} to ${className}: ${joinResult.error}`);
                            }
                        } catch (err) {
                            errors.push(`Failed to join user ${targetMxid} to ${className}: ${err.message}`);
                        }
                    }
                }
            } catch (err) {
                errors.push(`Error processing class ${className}: ${err.message}`);
            }
        }

        return {
            success: errors.length === 0 || spacesCreated.length > 0 || spacesDeleted.length > 0 || usersJoinedCount > 0 || usersKickedCount > 0,
            details: {
                created: spacesCreated,
                deleted: spacesDeleted,
                migrated: roomsMigrated,
                joined: usersJoinedCount,
                kicked: usersKickedCount,
                errors: errors
            },
            devMode
        };
    }

    /**
     * One-time migration: deletes old classroom rooms (from the previous non-Space implementation)
     * and drops the old 'classrooms' MongoDB collection.
     */
    async migrateOldClassrooms(homeserverUrl, token, errors) {
        const migrated = [];
        try {
            const db = mongoose.connection.db;
            const collections = await db.listCollections({ name: 'classrooms' }).toArray();
            if (collections.length === 0) return migrated;

            const collection = db.collection('classrooms');
            const oldEntries = await collection.find({}).toArray();

            if (oldEntries.length === 0) {
                await collection.drop();
                return migrated;
            }

            console.log(`[MatrixCreateClassRoomsTask] Migrating ${oldEntries.length} old classroom rooms to spaces...`);

            for (const room of oldEntries) {
                try {
                    const deleteUrl = `${homeserverUrl}/_synapse/admin/v1/rooms/${encodeURIComponent(room.roomId)}`;
                    const deleteRes = await fetch(deleteUrl, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ block: true, purge: true })
                    });

                    if (!deleteRes.ok && deleteRes.status !== 404) {
                        console.warn(`[MatrixCreateClassRoomsTask] Migration: Failed to delete room ${room.roomId}: ${await deleteRes.text()}`);
                    }

                    migrated.push(room.className);
                } catch (err) {
                    errors.push(`Migration: Failed to delete old room for ${room.className}: ${err.message}`);
                }
            }

            await collection.drop();
            console.log(`[MatrixCreateClassRoomsTask] Migration complete. Deleted ${migrated.length} old classroom rooms.`);
        } catch (e) {
            if (e.code !== 26) { // 26 = NamespaceNotFound
                console.warn(`[MatrixCreateClassRoomsTask] Migration error: ${e.message}`);
            }
        }
        return migrated;
    }

    /**
     * Sets the power level of a user in a space/room.
     */
    async setUserPowerLevel(homeserverUrl, token, spaceId, mxid, level) {
        try {
            const powerUrl = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(spaceId)}/state/m.room.power_levels`;
            const getRes = await fetch(powerUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!getRes.ok) return;

            const powerLevels = await getRes.json();
            powerLevels.users = powerLevels.users || {};

            // Only update if needed
            if (powerLevels.users[mxid] === level) return;

            powerLevels.users[mxid] = level;

            await fetch(powerUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(powerLevels)
            });
        } catch (e) {
            console.warn(`[MatrixCreateClassRoomsTask] Failed to set power level for ${mxid}: ${e.message}`);
        }
    }

    async getUntisClassTeachers() {
        const untis = getDomain('untis-teacher');
        if (!untis || !untis.dbConfig) return {};

        let connection;
        try {
            const mysql = require('mysql2/promise');
            connection = await mysql.createConnection(untis.dbConfig);
            const [rows] = await connection.execute(
                `SELECT c.Name as clazz, t.Name as teacher_initials
                 FROM Class c
                 LEFT JOIN Teacher t ON c.TEACHER_ID = t.TEACHER_ID
                 WHERE c.SCHOOL_ID = ? AND c.VERSION_ID = ? AND c.SCHOOLYEAR_ID = ?`,
                [untis.schulid, untis.version, untis.schuljahr]
            );

            const map = {};
            for (const r of rows) {
                if (r.clazz && r.teacher_initials) {
                    map[r.clazz.toUpperCase()] = r.teacher_initials;
                }
            }
            return map;
        } catch (e) {
            console.warn(`[MatrixCreateClassRoomsTask] Failed to query class teachers from Untis: ${e.message}`);
            return {};
        } finally {
            if (connection) await connection.end();
        }
    }

    format(report) {
        if (!report) return '-';
        if (report.success === false) return `<div style="color:var(--wa-color-danger-600)">Fehler: ${report.error || 'Unbekannter Fehler'}</div>`;

        let summaryParts = [];
        const details = report.details || {};
        if (details.migrated && details.migrated.length > 0) {
            summaryParts.push(`<span style="color: var(--wa-color-warning-600)">Alte Räume migriert: ${details.migrated.length}</span>`);
        }
        if (details.created && details.created.length > 0) {
            summaryParts.push(`<span style="color: var(--wa-color-success-600)">Spaces erstellt: ${details.created.length} (${details.created.join(', ')})</span>`);
        }
        if (details.deleted && details.deleted.length > 0) {
            summaryParts.push(`<span style="color: var(--wa-color-danger-600)">Spaces gelöscht: ${details.deleted.length} (${details.deleted.join(', ')})</span>`);
        }
        if (details.joined > 0) {
            summaryParts.push(`<span style="color: var(--wa-color-neutral-800)">Mitglieder hinzugefügt: ${details.joined}</span>`);
        }
        if (details.kicked > 0) {
            summaryParts.push(`<span style="color: var(--wa-color-neutral-800)">Mitglieder entfernt: ${details.kicked}</span>`);
        }
        if (details.errors && details.errors.length > 0) {
            summaryParts.push(`<span style="color: #EF4444">Fehler: ${details.errors.length}</span>`);
        }

        if (summaryParts.length === 0) {
            summaryParts.push('<span style="color:var(--wa-color-neutral-500)">Keine Änderungen</span>');
        }

        let msg = `<div>${summaryParts.join(', ')}`;
        if (report.devMode) {
             msg += ` <span style="color:var(--wa-color-warning-600); font-size:0.9em;">(DevMode Limit)</span>`;
        }
        msg += `</div>`;
        return msg;
    }
}

module.exports = MatrixCreateClassRoomsTask;
