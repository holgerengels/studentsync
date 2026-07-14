#!/usr/bin/env node
/**
 * Standalone test for MatrixMoodleCoursesTask.
 * Tests Moodle API + Matrix room creation without the full backend.
 */
const config = require('../src/config');

const moodleConfig = config.moodleCourses;
const matrixConfig = config.matrix;

async function moodleCall(wsfunction, params = {}) {
    const url = new URL(moodleConfig.url);
    url.pathname = '/webservice/rest/server.php';
    url.searchParams.set('wstoken', moodleConfig.token);
    url.searchParams.set('wsfunction', wsfunction);
    url.searchParams.set('moodlewsrestformat', 'json');
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.exception) throw new Error(`${wsfunction}: ${data.message}`);
    return data;
}

function getIncludedCategoryIds(categories, includeNames) {
    if (!includeNames || includeNames.length === 0) return new Set();
    const rootIds = new Set();
    for (const cat of categories) {
        if (includeNames.some(name => cat.name.toLowerCase() === name.toLowerCase())) {
            rootIds.add(cat.id);
        }
    }
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

async function main() {
    console.log('=== Moodle API Test ===\n');

    // 1. Load categories
    const categories = await moodleCall('core_course_get_categories');
    console.log(`Kategorien: ${categories.length} geladen`);

    const includeCategories = moodleConfig.includeCategories || [];
    const includedIds = getIncludedCategoryIds(categories, includeCategories);
    const filteredCats = categories.filter(c => includedIds.has(c.id));
    console.log(`Gefilterte Kategorien (${includeCategories.join(', ')}): ${filteredCats.length}`);
    
    // Show category tree
    filteredCats.sort((a, b) => a.depth - b.depth);
    for (const cat of filteredCats) {
        const indent = '  '.repeat(cat.depth);
        console.log(`${indent}📁 ${cat.name} (ID: ${cat.id}, parent: ${cat.parent}, ${cat.coursecount} Kurse)`);
    }

    const enabledFieldShortname = moodleConfig.customFields?.enabled || 'matrix_enabled';
    const roomNameFieldShortname = moodleConfig.customFields?.roomName || 'matrix_room_name';

    // 2. Load courses
    const allCourses = await moodleCall('core_course_get_courses');
    const courses = allCourses.filter(c => {
        if (c.id === 1 || !includedIds.has(c.categoryid)) return false;
        const field = (c.customfields || []).find(f => f.shortname === enabledFieldShortname);
        return field && (field.value === '1' || field.value === 1 || field.value === true || field.value === 'true');
    });
    console.log(`\nKurse in gefilterten Kategorien (mit Matrix aktiviert): ${courses.length}`);
    
    for (const c of courses) {
        const cat = categories.find(cat => cat.id === c.categoryid);
        const customNameField = (c.customfields || []).find(f => f.shortname === roomNameFieldShortname);
        const roomName = (customNameField && customNameField.value) ? customNameField.value.trim() : c.fullname;
        console.log(`  📖 ${roomName} (Original: ${c.fullname}, ID: ${c.id}, Kategorie: ${cat?.name || c.categoryid})`);
    }

    // 3. Test enrolled users for first course
    if (courses.length > 0) {
        const testCourse = courses[0];
        console.log(`\n=== Teilnehmer von "${testCourse.fullname}" ===`);
        const enrolled = await moodleCall('core_enrol_get_enrolled_users', { courseid: testCourse.id });
        console.log(`  ${enrolled.length} Teilnehmer:`);
        for (const user of enrolled) {
            const roles = (user.roles || []).map(r => r.shortname).join(', ');
            console.log(`    ${user.username} (${user.fullname}) - Rollen: ${roles}`);
        }
    }

    console.log('\n✓ Moodle API funktioniert!');
}

main().catch(e => console.error('ERROR:', e.message));
