const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');
const { isDevMode, limitInDevMode } = require('../../utils/devMode');
const config = require('../../config');
const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
    className: { type: String, required: true, unique: true },
    roomId: { type: String, required: true }
});

const ClassroomModel = mongoose.models.Classroom || mongoose.model('Classroom', classroomSchema);

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
                console.warn(`[MatrixCreateClassRoomsTask] Error getting joined members for room ${roomId}: ${err.message}`);
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
                console.warn(`[MatrixCreateClassRoomsTask] Failed to kick user ${mxid} from room ${roomId}: ${await kickRes.text()}`);
            } catch (err) {
                console.warn(`[MatrixCreateClassRoomsTask] Error kicking user ${mxid} from room ${roomId}: ${err.message}`);
            }
            return false;
        };

        // Ensure teacher mapping is populated
        if (matrixTeacher) {
            await matrixTeacher.getIdentities();
        }

        // 1. Get all students and group by class
        const students = await schulkonsole.getIdentities();
        const classesMap = {}; // clazz -> students array
        const activeClasses = new Set();

        for (const s of students) {
            if (s.clazz) {
                const normalizedClass = s.clazz.toUpperCase();
                activeClasses.add(normalizedClass);
                if (!classesMap[normalizedClass]) {
                    classesMap[normalizedClass] = [];
                }
                classesMap[normalizedClass].push(s);
            }
        }

        // 2. Deprovision (delete) classrooms that no longer exist
        const roomsDeleted = [];
        const errors = [];

        try {
            const existingClassrooms = await ClassroomModel.find({}).lean();
            const classroomsToDelete = existingClassrooms.filter(room => !activeClasses.has(room.className.toUpperCase()));

            // Limit room deletions in DevMode
            const { items: deletionsToProcess } = limitInDevMode(classroomsToDelete);

            for (const room of deletionsToProcess) {
                try {
                    // Try Synapse Delete Room Admin API
                    const deleteUrl = `${homeserverUrl}/_synapse/admin/v1/rooms/${encodeURIComponent(room.roomId)}`;
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
                        console.warn(`[MatrixCreateClassRoomsTask] Failed to delete room ${room.roomId} on server: ${errText}`);
                    }

                    await ClassroomModel.deleteOne({ _id: room._id });
                    roomsDeleted.push(room.className);
                } catch (err) {
                    errors.push(`Failed to delete obsolete classroom for ${room.className}: ${err.message}`);
                }
            }
        } catch (dbErr) {
            errors.push(`Database error checking obsolete classrooms: ${dbErr.message}`);
        }

        // 3. Resolve class/subject teachers
        const configClassTeachers = config.classTeachers || config.matrix?.classTeachers || {};
        const untisClassTeachers = await this.getUntisClassTeachers();
        const classTeachers = { ...untisClassTeachers, ...configClassTeachers };

        // 4. Process active classes (respect DevMode limit)
        const classNames = Array.from(activeClasses).sort();
        const { items: classesToProcess } = limitInDevMode(classNames);

        const roomsCreated = [];
        let usersJoinedCount = 0;
        let usersKickedCount = 0;

        for (const className of classesToProcess) {
            try {
                const aliasLocalpart = `class_${className.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                const fullAlias = `#${aliasLocalpart}:${homeserverDomain}`;

                // Check if room exists by resolving alias
                let roomId = null;
                try {
                    const resolveUrl = `${homeserverUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(fullAlias)}`;
                    const resolveRes = await fetch(resolveUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (resolveRes.ok) {
                        const data = await resolveRes.json();
                        roomId = data.room_id;
                    }
                } catch (e) {
                    // Ignore resolution errors
                }

                // Create room if not existing
                if (!roomId) {
                    const createUrl = `${homeserverUrl}/_matrix/client/v3/createRoom`;
                    const createRes = await fetch(createUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: `Klasse ${className}`,
                            topic: `Klassenraum für Klasse ${className}`,
                            visibility: 'private',
                            preset: 'private_chat',
                            room_alias_name: aliasLocalpart
                        })
                    });

                    if (!createRes.ok) {
                        const errText = await createRes.text();
                        throw new Error(`Failed to create room for ${className}: ${errText}`);
                    }

                    const createData = await createRes.json();
                    roomId = createData.room_id;
                    roomsCreated.push(className);
                }

                // Save or update in MongoDB Classroom tracker
                await ClassroomModel.updateOne(
                    { className: className.toUpperCase() },
                    {
                        $set: {
                            className: className.toUpperCase(),
                            roomId: roomId
                        }
                    },
                    { upsert: true }
                );

                // Get current joined members in room
                const joinedMembers = await getJoinedMembers(roomId);

                // Build set of target user MXIDs
                const targetMxids = new Set();
                const classStudents = classesMap[className] || [];
                for (const student of classStudents) {
                    targetMxids.add(`@${student.userId}:${homeserverDomain}`);
                }
                const teacherInitials = classTeachers[className];
                if (teacherInitials && matrixTeacher) {
                    const teacherLogin = matrixTeacher.initialsToLogin.get(teacherInitials.toLowerCase());
                    if (teacherLogin) {
                        targetMxids.add(`@${teacherLogin}:${homeserverDomain}`);
                    }
                }

                // 1. Kick members who should not be in the room
                for (const joinedUser of joinedMembers) {
                    const adminMxid = `@${matrix.adminUsername}:${homeserverDomain}`;
                    if (joinedUser !== adminMxid && !targetMxids.has(joinedUser)) {
                        try {
                            const kickSuccess = await kickUserFromRoom(joinedUser, roomId);
                            if (kickSuccess) {
                                usersKickedCount++;
                            }
                        } catch (err) {
                            errors.push(`Failed to kick user ${joinedUser} from ${className}: ${err.message}`);
                        }
                    }
                }

                // 2. Join members who should be in the room but are not yet
                for (const targetMxid of targetMxids) {
                    if (!joinedMembers.includes(targetMxid)) {
                        try {
                            const joinResult = await joinUserToRoom(targetMxid, roomId);
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
            success: errors.length === 0 || roomsCreated.length > 0 || roomsDeleted.length > 0 || usersJoinedCount > 0 || usersKickedCount > 0,
            details: {
                created: roomsCreated,
                deleted: roomsDeleted,
                joined: usersJoinedCount,
                kicked: usersKickedCount,
                errors: errors
            },
            devMode
        };
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
        if (details.created && details.created.length > 0) {
            summaryParts.push(`<span style="color: var(--wa-color-success-600)">Räume erstellt: ${details.created.length} (${details.created.join(', ')})</span>`);
        }
        if (details.deleted && details.deleted.length > 0) {
            summaryParts.push(`<span style="color: var(--wa-color-danger-600)">Räume gelöscht: ${details.deleted.length} (${details.deleted.join(', ')})</span>`);
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
