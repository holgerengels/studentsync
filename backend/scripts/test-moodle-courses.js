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

    const buildQuery = (params, prefix = '') => {
        const query = [];
        for (const [key, value] of Object.entries(params)) {
            const paramName = prefix ? `${prefix}[${key}]` : key;
            if (value !== null && typeof value === 'object') {
                query.push(...buildQuery(value, paramName));
            } else if (value !== undefined) {
                query.push([paramName, value]);
            }
        }
        return query;
    };

    const queryParams = buildQuery(params);
    for (const [key, value] of queryParams) {
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

    // 2. Load courses per category
    const courses = [];
    for (const catId of includedIds) {
        try {
            const catCourses = await moodleCall('core_course_get_courses_by_field', {
                field: 'category', value: catId
            });
            const rawCourses = (catCourses.courses || catCourses || []).filter(c => c.id !== 1);
            if (rawCourses.length === 0) continue;

            // Fetch detailed courses (Fast path: single batch request)
            const courseIds = rawCourses.map(c => c.id);
            let detailedCourses = [];
            try {
                detailedCourses = await moodleCall('core_course_get_courses', {
                    options: { ids: courseIds }
                });
                for (const dc of detailedCourses) {
                    console.log(`🔍 Course "${dc.fullname}" (ID: ${dc.id}) custom fields:`, JSON.stringify(dc.customfields || []));
                }
            } catch (err) {
                console.warn(`  ⚠ Batch load failed for category ${catId} (${err.message}). Falling back to individual course loading.`);
                // Slow path fallback: fetch course-by-course to isolate the broken course
                for (const rc of rawCourses) {
                    try {
                        const detail = await moodleCall('core_course_get_courses', {
                            options: { ids: [rc.id] }
                        });
                        const detailedCourse = detail[0];
                        if (detailedCourse) {
                            console.log(`🔍 Course "${detailedCourse.fullname}" (ID: ${detailedCourse.id}) custom fields:`, JSON.stringify(detailedCourse.customfields || []));
                            detailedCourses.push(detailedCourse);
                        }
                    } catch (singleErr) {
                        console.warn(`  ⚠ Failed to load details for course ID ${rc.id} (${rc.fullname}): ${singleErr.message}`);
                    }
                }
            }

            const visible = detailedCourses.filter(c => {
                const field = (c.customfields || []).find(f => f.shortname === enabledFieldShortname);
                return field && (
                    field.valueraw === 1 || field.valueraw === '1' || field.valueraw === true ||
                    field.value === '1' || field.value === 1 || field.value === true || field.value === 'true' ||
                    field.value === 'Ja' || field.value === 'Yes'
                );
            });
            courses.push(...visible);
        } catch (e) {
            console.warn(`  ⚠ Failed to load courses list for category ${catId}: ${e.message}`);
        }
    }
    console.log(`\nKurse in gefilterten Kategorien (mit Matrix aktiviert): ${courses.length}`);
    
    for (const c of courses) {
        const cat = categories.find(cat => cat.id === c.categoryid);
        console.log(`  📖 ${c.fullname} (ID: ${c.id}, Kategorie: ${cat?.name || c.categoryid})`);
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
