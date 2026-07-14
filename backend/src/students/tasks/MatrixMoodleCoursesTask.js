const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');
const { isDevMode, limitInDevMode } = require('../../utils/devMode');
const config = require('../../config');
const mongoose = require('mongoose');

// MongoDB schemas for tracking
const moodleSpaceSchema = new mongoose.Schema({
    categoryId: { type: Number, required: true, unique: true },
    categoryName: String,
    spaceId: { type: String, required: true },
    parentCategoryId: Number
});

const moodleRoomSchema = new mongoose.Schema({
    courseId: { type: Number, required: true, unique: true },
    courseName: String,
    roomId: { type: String, required: true },
    categoryId: Number
});

const MoodleSpaceModel = mongoose.models.MoodleSpace || mongoose.model('MoodleSpace', moodleSpaceSchema);
const MoodleRoomModel = mongoose.models.MoodleRoom || mongoose.model('MoodleRoom', moodleRoomSchema);

class MatrixMoodleCoursesTask extends Task {
    constructor() {
        super('matrix-moodle-courses');
    }

    async execute(parameters = {}) {
        const matrix = getDomain('matrix');
        if (!matrix) {
            throw new Error('Required domain (matrix) is not available.');
        }

        const moodleConfig = config.moodleCourses;
        if (!moodleConfig || !moodleConfig.url || !moodleConfig.token) {
            throw new Error('moodleCourses configuration missing (url, token required)');
        }

        const devMode = isDevMode();
        const token = await matrix.ensureAdminToken();
        const homeserverUrl = matrix.homeserverUrl;
        const homeserverDomain = matrix.homeserverDomainName;
        const botMxid = `@${matrix.adminUsername}:${homeserverDomain}`;
        const allMoodleCourseIds = new Set();

        // Resolve admin room for Tuwunel force-join commands
        let adminRoomId = null;
        try {
            adminRoomId = await this.resolveAlias(homeserverUrl, token, `#admins:${homeserverDomain}`);
        } catch (e) { /* ignore */ }

        const errors = [];
        const spacesCreated = [];
        const roomsCreated = [];
        let usersJoinedCount = 0;
        let usersKickedCount = 0;

        // 1. Load categories and courses from Moodle
        console.log('[MoodleCourses] Loading categories from Moodle...');
        const categories = await this.moodleCall(moodleConfig, 'core_course_get_categories');
        console.log(`[MoodleCourses] Loaded ${categories.length} categories`);

        // Filter categories: only include those under configured root categories
        const includeCategories = moodleConfig.includeCategories || [];
        const includedCategoryIds = this.getIncludedCategoryIds(categories, includeCategories);

        const enabledFieldShortname = moodleConfig.customFields?.enabled || 'matrix_enabled';
        const roomNameFieldShortname = moodleConfig.customFields?.roomName || 'matrix_room_name';

        // Load courses per included category (avoids permission errors on inaccessible courses)
        console.log('[MoodleCourses] Loading courses from Moodle...');
        const filteredCourses = [];
        for (const catId of includedCategoryIds) {
            try {
                const catCourses = await this.moodleCall(moodleConfig, 'core_course_get_courses_by_field', {
                    field: 'category', value: catId
                });
                const visible = (catCourses.courses || catCourses).filter(c => c.id !== 1);
                
                // Track all existing course IDs
                for (const c of visible) {
                    allMoodleCourseIds.add(c.id);
                }
                
                // Filter by custom field matrix_enabled
                const matrixEnabledCourses = visible.filter(c => {
                    const field = (c.customfields || []).find(f => f.shortname === enabledFieldShortname);
                    return field && (field.value === '1' || field.value === 1 || field.value === true || field.value === 'true');
                });
                
                filteredCourses.push(...matrixEnabledCourses);
            } catch (e) {
                console.warn(`[MoodleCourses] Failed to load courses for category ${catId}: ${e.message}`);
            }
        }
        console.log(`[MoodleCourses] Loaded ${filteredCourses.length} courses with Matrix enabled`);

        // Apply devMode limit
        const { items: coursesToProcess } = limitInDevMode(filteredCourses);

        // 2. Create spaces for categories (hierarchical)
        const categorySpaceMap = new Map(); // categoryId -> spaceId

        // Build category tree
        const filteredCategories = includedCategoryIds.size > 0
            ? categories.filter(c => includedCategoryIds.has(c.id))
            : categories;

        // Sort by depth so parents are created first
        filteredCategories.sort((a, b) => a.depth - b.depth);

        for (const cat of filteredCategories) {
            try {
                const aliasLocalpart = `moodle_cat_${cat.id}`;
                const fullAlias = `#${aliasLocalpart}:${homeserverDomain}`;

                // Check if space exists
                let spaceId = await this.resolveAlias(homeserverUrl, token, fullAlias);

                if (!spaceId) {
                    // Create space
                    const createRes = await fetch(`${homeserverUrl}/_matrix/client/v3/createRoom`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: cat.name,
                            topic: cat.description ? cat.description.replace(/<[^>]*>/g, '') : '',
                            visibility: 'private',
                            room_alias_name: aliasLocalpart,
                            creation_content: { type: 'm.space' },
                            initial_state: [{
                                type: 'm.room.join_rules',
                                state_key: '',
                                content: { join_rule: 'invite' }
                            }]
                        })
                    });

                    if (createRes.ok) {
                        spaceId = (await createRes.json()).room_id;
                        spacesCreated.push(cat.name);
                        console.log(`[MoodleCourses] Created space "${cat.name}" (${spaceId})`);
                    } else {
                        errors.push(`Failed to create space for category "${cat.name}": ${await createRes.text()}`);
                        continue;
                    }
                }

                categorySpaceMap.set(cat.id, spaceId);

                // Save to MongoDB
                await MoodleSpaceModel.updateOne(
                    { categoryId: cat.id },
                    { $set: { categoryId: cat.id, categoryName: cat.name, spaceId, parentCategoryId: cat.parent } },
                    { upsert: true }
                );

                // Nest under parent space if parent exists
                if (cat.parent && categorySpaceMap.has(cat.parent)) {
                    const parentSpaceId = categorySpaceMap.get(cat.parent);
                    await this.setSpaceChild(homeserverUrl, token, parentSpaceId, spaceId, homeserverDomain);
                }
            } catch (e) {
                errors.push(`Error processing category "${cat.name}": ${e.message}`);
            }
        }

        // 3. Create rooms for courses and sync members
        for (const course of coursesToProcess) {
            try {
                const aliasLocalpart = `moodle_course_${course.id}`;
                const fullAlias = `#${aliasLocalpart}:${homeserverDomain}`;

                // Get custom room name if set, otherwise fallback to course fullname
                const customNameField = (course.customfields || []).find(f => f.shortname === roomNameFieldShortname);
                const roomName = (customNameField && customNameField.value) ? customNameField.value.trim() : course.fullname;

                // Check if room exists
                let roomId = await this.resolveAlias(homeserverUrl, token, fullAlias);

                if (!roomId) {
                    // Create room
                    const createRes = await fetch(`${homeserverUrl}/_matrix/client/v3/createRoom`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: roomName,
                            topic: course.summary ? course.summary.replace(/<[^>]*>/g, '') : '',
                            visibility: 'private',
                            room_alias_name: aliasLocalpart,
                            initial_state: [{
                                type: 'm.room.join_rules',
                                state_key: '',
                                content: { join_rule: 'invite' }
                            }]
                        })
                    });

                    if (createRes.ok) {
                        roomId = (await createRes.json()).room_id;
                        roomsCreated.push(roomName);
                        console.log(`[MoodleCourses] Created room "${roomName}" (${roomId})`);
                    } else {
                        errors.push(`Failed to create room for course "${roomName}": ${await createRes.text()}`);
                        continue;
                    }
                } else {
                    // Update room name if it changed
                    await this.updateRoomName(homeserverUrl, token, roomId, roomName);
                }

                // Save to MongoDB
                await MoodleRoomModel.updateOne(
                    { courseId: course.id },
                    { $set: { courseId: course.id, courseName: roomName, roomId, categoryId: course.categoryid } },
                    { upsert: true }
                );

                // Add room as child of category space
                const categorySpaceId = categorySpaceMap.get(course.categoryid);
                if (categorySpaceId) {
                    await this.setSpaceChild(homeserverUrl, token, categorySpaceId, roomId, homeserverDomain);
                }

                // 4. Sync members
                const enrolled = await this.moodleCall(moodleConfig, 'core_enrol_get_enrolled_users', {
                    courseid: course.id
                });

                // Build target member sets
                const targetMxids = new Set();
                const moderatorMxids = new Set();

                for (const user of enrolled) {
                    const mxid = `@${user.username}:${homeserverDomain}`;
                    targetMxids.add(mxid);

                    // Check if user has teacher role
                    const isTeacher = (user.roles || []).some(r =>
                        r.shortname === 'editingteacher' || r.shortname === 'teacher' || r.shortname === 'manager'
                    );
                    if (isTeacher) {
                        moderatorMxids.add(mxid);
                    }
                }

                // Get current room members
                const joinedMembers = await this.getJoinedMembers(homeserverUrl, token, roomId);

                // Kick users no longer enrolled (but not the bot)
                for (const member of joinedMembers) {
                    if (member !== botMxid && !targetMxids.has(member)) {
                        const kicked = await this.kickUser(homeserverUrl, token, roomId, member);
                        if (kicked) usersKickedCount++;
                    }
                }

                // Join users who should be in the room
                for (const mxid of targetMxids) {
                    if (!joinedMembers.includes(mxid)) {
                        const joined = await this.joinUser(homeserverUrl, token, adminRoomId, roomId, mxid);
                        if (joined) usersJoinedCount++;
                        else errors.push(`Failed to join ${mxid} to "${roomName}"`);
                    }
                }

                // Set moderator power levels for teachers
                for (const mxid of moderatorMxids) {
                    await this.setUserPowerLevel(homeserverUrl, token, roomId, mxid, 50);
                }
            } catch (e) {
                errors.push(`Error processing course "${roomName}": ${e.message}`);
            }
        }

        // 5. Reconcile: clean up MongoDB entries for rooms/spaces that no longer exist on Matrix
        let reconciledRooms = 0;
        let reconciledSpaces = 0;
        try {
            const allRoomDocs = await MoodleRoomModel.find({}).lean();
            for (const doc of allRoomDocs) {
                // Remove permanently if course no longer exists in Moodle (or is no longer in managed categories)
                if (!allMoodleCourseIds.has(doc.courseId)) {
                    console.log(`[MoodleCourses] Reconcile: course ${doc.courseId} ("${doc.courseName}") no longer exists in Moodle. Permanently deleting Matrix room ${doc.roomId}...`);
                    await this.deleteMatrixRoom(homeserverUrl, token, adminRoomId, botMxid, doc.roomId);
                    await MoodleRoomModel.deleteOne({ _id: doc._id });
                    reconciledRooms++;
                    continue;
                }

                // If course exists in Moodle, but matrix_enabled is false/not present in filteredCourses
                const isActive = filteredCourses.some(c => c.id === doc.courseId);
                if (!isActive) {
                    // Do NOT delete the room on Matrix, just remove the local cache record so we stop syncing members
                    await MoodleRoomModel.deleteOne({ _id: doc._id });
                    reconciledRooms++;
                    console.log(`[MoodleCourses] Reconcile: Matrix sync disabled for "${doc.courseName}" (course ${doc.courseId}). Entry removed from cache.`);
                    continue;
                }

                // Remove if room no longer exists on Matrix
                const members = await this.getJoinedMembers(homeserverUrl, token, doc.roomId);
                if (members.length === 0) {
                    const alias = await this.resolveAlias(homeserverUrl, token, `#moodle_course_${doc.courseId}:${homeserverDomain}`);
                    if (!alias) {
                        await MoodleRoomModel.deleteOne({ _id: doc._id });
                        reconciledRooms++;
                        console.log(`[MoodleCourses] Reconcile: removed orphaned room entry "${doc.courseName}"`);
                    }
                }
            }

            const allSpaceDocs = await MoodleSpaceModel.find({}).lean();
            for (const doc of allSpaceDocs) {
                if (!includedCategoryIds.has(doc.categoryId)) {
                    await MoodleSpaceModel.deleteOne({ _id: doc._id });
                    reconciledSpaces++;
                    console.log(`[MoodleCourses] Reconcile: removed stale space entry "${doc.categoryName}"`);
                    continue;
                }
                const members = await this.getJoinedMembers(homeserverUrl, token, doc.spaceId);
                if (members.length === 0) {
                    const alias = await this.resolveAlias(homeserverUrl, token, `#moodle_cat_${doc.categoryId}:${homeserverDomain}`);
                    if (!alias) {
                        await MoodleSpaceModel.deleteOne({ _id: doc._id });
                        reconciledSpaces++;
                        console.log(`[MoodleCourses] Reconcile: removed orphaned space entry "${doc.categoryName}"`);
                    }
                }
            }
        } catch (e) {
            errors.push(`Reconcile error: ${e.message}`);
        }

        return {
            success: errors.length === 0 || spacesCreated.length > 0 || roomsCreated.length > 0,
            details: {
                spacesCreated,
                roomsCreated,
                joined: usersJoinedCount,
                kicked: usersKickedCount,
                reconciled: reconciledRooms + reconciledSpaces,
                errors
            },
            devMode
        };
    }

    // --- Moodle API ---

    async moodleCall(moodleConfig, wsfunction, params = {}) {
        const url = new URL(moodleConfig.url);
        url.pathname = '/webservice/rest/server.php';
        url.searchParams.set('wstoken', moodleConfig.token);
        url.searchParams.set('wsfunction', wsfunction);
        url.searchParams.set('moodlewsrestformat', 'json');

        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }

        const res = await fetch(url.toString());
        if (!res.ok) {
            throw new Error(`Moodle API ${wsfunction} failed: ${res.status} ${await res.text()}`);
        }

        const data = await res.json();
        if (data.exception) {
            throw new Error(`Moodle API ${wsfunction}: ${data.message || data.exception}`);
        }
        return data;
    }

    /**
     * Get all category IDs that are children of the named root categories.
     */
    getIncludedCategoryIds(categories, includeNames) {
        if (!includeNames || includeNames.length === 0) return new Set();

        const categoryMap = new Map(); // id -> category
        for (const cat of categories) {
            categoryMap.set(cat.id, cat);
        }

        // Find root category IDs by name (case-insensitive)
        const rootIds = new Set();
        for (const cat of categories) {
            if (includeNames.some(name => cat.name.toLowerCase() === name.toLowerCase())) {
                rootIds.add(cat.id);
            }
        }

        // BFS to include all children
        const included = new Set(rootIds);
        const queue = [...rootIds];
        while (queue.length > 0) {
            const parentId = queue.shift();
            for (const cat of categories) {
                if (cat.parent === parentId && !included.has(cat.id)) {
                    included.add(cat.id);
                    queue.push(cat.id);
                }
            }
        }

        return included;
    }

    // --- Matrix helpers ---

    async resolveAlias(homeserverUrl, token, alias) {
        try {
            const res = await fetch(
                `${homeserverUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(alias)}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (res.ok) return (await res.json()).room_id;
        } catch (e) { /* ignore */ }
        return null;
    }

    async getJoinedMembers(homeserverUrl, token, roomId) {
        try {
            const res = await fetch(
                `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/joined_members`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (res.ok) return Object.keys((await res.json()).joined || {});
        } catch (e) { /* ignore */ }
        return [];
    }

    async joinUser(homeserverUrl, token, adminRoomId, roomId, mxid) {
        // Try invite first
        try {
            await fetch(`${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: mxid })
            });
        } catch (e) { /* ignore */ }

        // Force-join via Tuwunel admin command
        if (adminRoomId) {
            try {
                const cmd = `!admin users force-join-room ${mxid} ${roomId}`;
                const txnId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
                const sendRes = await fetch(
                    `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(adminRoomId)}/send/m.room.message/${txnId}`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ msgtype: 'm.text', body: cmd })
                    }
                );
                if (sendRes.ok) {
                    await new Promise(r => setTimeout(r, 100));
                    return true;
                }
            } catch (e) { /* ignore */ }
        }

        return false;
    }

    async kickUser(homeserverUrl, token, roomId, mxid) {
        try {
            const res = await fetch(`${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/kick`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: mxid, reason: 'No longer enrolled in course' })
            });
            return res.ok;
        } catch (e) { return false; }
    }

    async setUserPowerLevel(homeserverUrl, token, roomId, mxid, level) {
        try {
            const path = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels`;
            const res = await fetch(path, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) return;
            const powerLevels = await res.json();
            powerLevels.users = powerLevels.users || {};
            if (powerLevels.users[mxid] === level) return;
            powerLevels.users[mxid] = level;
            await fetch(path, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(powerLevels)
            });
        } catch (e) { /* ignore */ }
    }

    async setSpaceChild(homeserverUrl, token, spaceId, childId, domain) {
        try {
            const path = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(spaceId)}/state/m.space.child/${childId}`;
            await fetch(path, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ via: [domain] })
            });
        } catch (e) { /* ignore */ }
    }

    async updateRoomName(homeserverUrl, token, roomId, name) {
        try {
            const path = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name`;
            const res = await fetch(path, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const current = await res.json();
                if (current.name === name) return;
            }
            await fetch(path, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
        } catch (e) { /* ignore */ }
    }

    async deleteMatrixRoom(homeserverUrl, token, adminRoomId, botMxid, roomId) {
        // 1. Bot joins room first to be able to kick
        try {
            await fetch(`${homeserverUrl}/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) { /* ignore */ }

        // 2. Get and kick members
        const members = await this.getJoinedMembers(homeserverUrl, token, roomId);
        const toKick = members.filter(m => m !== botMxid);
        for (const mxid of toKick) {
            try {
                const kickRes = await fetch(`${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/kick`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: mxid, reason: 'Moodle course has been deleted' })
                });
                if (!kickRes.ok && adminRoomId) {
                    // Try force-leave if direct kick fails
                    await this.sendAdminCommand(homeserverUrl, token, adminRoomId, `!admin users force-leave-room ${mxid} ${roomId}`);
                }
            } catch (e) { /* ignore */ }
        }

        // 3. Bot leaves room
        try {
            await fetch(`${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/leave`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) { /* ignore */ }

        // 4. Delete the room via admin command
        if (adminRoomId) {
            try {
                await this.sendAdminCommand(homeserverUrl, token, adminRoomId, `!admin rooms delete --force ${roomId}`);
            } catch (e) { /* ignore */ }
        }
    }

    async sendAdminCommand(homeserverUrl, token, adminRoomId, command) {
        const txnId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        await fetch(`${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(adminRoomId)}/send/m.room.message/${txnId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ msgtype: 'm.text', body: command })
        });
        await new Promise(r => setTimeout(r, 100));
    }
}

module.exports = MatrixMoodleCoursesTask;
