const MatrixMoodleCoursesTask = require('../../src/students/tasks/MatrixMoodleCoursesTask');
const { registerDomain, clearRegistry } = require('../../src/domains/registry');
const config = require('../../src/config');
const mongoose = require('mongoose');

// Mock mongoose
var mockMoodleSpaceModel;
var mockMoodleRoomModel;
jest.mock('mongoose', () => {
    const original = jest.requireActual('mongoose');
    mockMoodleSpaceModel = {
        updateOne: jest.fn().mockResolvedValue({}),
        find: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
        deleteOne: jest.fn().mockResolvedValue({})
    };
    mockMoodleRoomModel = {
        updateOne: jest.fn().mockResolvedValue({}),
        find: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
        deleteOne: jest.fn().mockResolvedValue({})
    };
    return {
        ...original,
        connect: jest.fn().mockResolvedValue(null),
        connection: { readyState: 0, close: jest.fn() },
        model: jest.fn((name) => {
            if (name === 'MoodleSpace') return mockMoodleSpaceModel;
            if (name === 'MoodleRoom') return mockMoodleRoomModel;
            return {};
        }),
        models: {
            MoodleSpace: mockMoodleSpaceModel,
            MoodleRoom: mockMoodleRoomModel
        }
    };
});

describe('MatrixMoodleCoursesTask', () => {
    let mockFetch;

    beforeEach(() => {
        clearRegistry();
        mockFetch = jest.fn();
        global.fetch = mockFetch;
        jest.clearAllMocks();
        config.moodleCourses = {
            url: 'https://moodle.test',
            token: 'test-token',
            includeCategories: ['Kursbereich', 'Fachbereiche']
        };
        config.settings = { devMode: false };
    });

    it('should filter courses by matrix_enabled and use custom room name', async () => {
        // 1. Mock Matrix domain
        const mockMatrix = {
            domainName: 'matrix',
            homeserverUrl: 'https://matrix.test',
            homeserverDomainName: 'matrix.test',
            ensureAdminToken: jest.fn().mockResolvedValue('admin-token'),
            adminUsername: 'synx.admin'
        };
        registerDomain(mockMatrix);

        // 2. Instantiate task and mock moodleCall
        const task = new MatrixMoodleCoursesTask();
        
        task.moodleCall = jest.fn().mockImplementation(async (cfg, method, params) => {
            if (method === 'core_course_get_categories') {
                return [
                    { id: 10, name: 'Kursbereich', depth: 1, parent: 0 },
                    { id: 11, name: 'Fachbereiche', depth: 1, parent: 0 },
                    { id: 12, name: 'Unrelated Category', depth: 1, parent: 0 }
                ];
            }
            if (method === 'core_course_get_courses_by_field' && params.field === 'category') {
                if (params.value === 10) {
                    return {
                        courses: [
                            {
                                id: 101,
                                fullname: 'Math 101',
                                categoryid: 10,
                                customfields: [
                                    { shortname: 'matrix_enabled', value: '1' },
                                    { shortname: 'matrix_room_name', value: 'Custom Math Room' }
                                ]
                            },
                            {
                                id: 102,
                                fullname: 'History 101',
                                categoryid: 10,
                                customfields: [
                                    { shortname: 'matrix_enabled', value: '0' }
                                ]
                            }
                        ]
                    };
                }
                if (params.value === 11) {
                    return {
                        courses: [
                            {
                                id: 201,
                                fullname: 'Physics 101',
                                categoryid: 11,
                                customfields: [
                                    { shortname: 'matrix_enabled', value: '1' }
                                ]
                            }
                        ]
                    };
                }
            }
            if (method === 'core_course_get_courses') {
                const allMockCourses = [
                    {
                        id: 101,
                        fullname: 'Math 101',
                        categoryid: 10,
                        customfields: [
                            { shortname: 'matrix_enabled', value: '1' }
                        ]
                    },
                    {
                        id: 102,
                        fullname: 'History 101',
                        categoryid: 10,
                        customfields: [
                            { shortname: 'matrix_enabled', value: '0' }
                        ]
                    },
                    {
                        id: 201,
                        fullname: 'Physics 101',
                        categoryid: 11,
                        customfields: [
                            { shortname: 'matrix_enabled', value: '1' }
                        ]
                    }
                ];
                const requestedIds = params.options?.ids || [];
                return allMockCourses.filter(c => requestedIds.includes(c.id));
            }
            if (method === 'core_enrol_get_enrolled_users') {
                return [
                    { username: 'student1', fullname: 'Student One', roles: [{ shortname: 'student' }] },
                    { username: 'teacher1', fullname: 'Teacher One', roles: [{ shortname: 'editingteacher' }] }
                ];
            }
            return [];
        });

        // Mock Matrix room alias resolution and room creation responses
        mockFetch.mockImplementation(async (url, options) => {
            // resolve alias
            if (url.includes('/directory/room/')) {
                return { ok: false, status: 404 }; // room does not exist yet
            }
            // createRoom
            if (url.includes('/createRoom')) {
                const body = JSON.parse(options.body);
                // Return a mock roomId based on name
                const mockRoomId = `!room-${body.name.replace(/\s+/g, '-').toLowerCase()}:matrix.test`;
                return {
                    ok: true,
                    json: async () => ({ room_id: mockRoomId })
                };
            }
            // join/kick/state events
            return { ok: true, json: async () => ({}) };
        });

        const report = await task.execute();

        expect(report.success).toBe(true);
        // Only Math 101 and Physics 101 should be processed because History 101 matrix_enabled is '0'
        expect(report.details.spacesCreated).toContain('Kursbereich');
        expect(report.details.spacesCreated).toContain('Fachbereiche');
        
        expect(report.details.roomsCreated).toContain('Math 101');
        expect(report.details.roomsCreated).toContain('Physics 101');
        expect(report.details.roomsCreated).not.toContain('History 101');
        expect(report.details.roomsCreated).not.toContain('Custom Math Room');
 
        // Verify updateOne was called with correctly updated names
        expect(mockMoodleRoomModel.updateOne).toHaveBeenCalledWith(
            { courseId: 101 },
            expect.objectContaining({
                $set: expect.objectContaining({
                    courseName: 'Math 101'
                })
            }),
            { upsert: true }
        );
    });

    it('should permanently delete rooms for courses that no longer exist in Moodle, but keep rooms for courses that exist but are disabled', async () => {
        // 1. Mock Matrix domain
        const mockMatrix = {
            domainName: 'matrix',
            homeserverUrl: 'https://matrix.test',
            homeserverDomainName: 'matrix.test',
            ensureAdminToken: jest.fn().mockResolvedValue('admin-token'),
            adminUsername: 'synx.admin'
        };
        registerDomain(mockMatrix);

        // 2. Mock DB cache with two rooms:
        // - Course 101: still exists in Moodle but matrix_enabled is false (should NOT be deleted on Matrix, only DB record deleted)
        // - Course 301: no longer exists in Moodle (should be deleted on Matrix and DB record deleted)
        mockMoodleRoomModel.lean.mockResolvedValue([
            { _id: 'room-101-doc-id', courseId: 101, courseName: 'Disabled Course', roomId: '!room-101:matrix.test' },
            { _id: 'room-301-doc-id', courseId: 301, courseName: 'Deleted Course', roomId: '!room-301:matrix.test' }
        ]);

        const task = new MatrixMoodleCoursesTask();
        
        task.moodleCall = jest.fn().mockImplementation(async (cfg, method, params) => {
            if (method === 'core_course_get_categories') {
                return [{ id: 10, name: 'Kursbereich', depth: 1, parent: 0 }];
            }
            if (method === 'core_course_get_courses_by_field' && params.field === 'category') {
                return {
                    courses: [
                        {
                            id: 101, // still exists in Moodle
                            fullname: 'Disabled Course',
                            categoryid: 10,
                            customfields: [
                                { shortname: 'matrix_enabled', value: '0' } // but disabled
                            ]
                        }
                        // Course 301 is missing entirely
                    ]
                };
            }
            if (method === 'core_enrol_get_enrolled_users') {
                return [];
            }
            return [];
        });

        // Track calls to fetch (specifically joins, kicks, leaves, admin commands)
        const fetchCalls = [];
        mockFetch.mockImplementation(async (url, options) => {
            fetchCalls.push({ url, method: options?.method, body: options?.body ? JSON.parse(options.body) : null });
            if (url.includes('/directory/room/%23admins')) {
                return { ok: true, json: async () => ({ room_id: '!admins-room:matrix.test' }) };
            }
            if (url.includes('/joined_members')) {
                return { ok: true, json: async () => ({ joined: { '@student1:matrix.test': {} } }) };
            }
            return { ok: true, json: async () => ({}) };
        });

        const report = await task.execute();

        expect(report.success).toBe(true);

        // Verify that BOTH are removed from local DB cache
        expect(mockMoodleRoomModel.deleteOne).toHaveBeenCalledWith({ _id: 'room-101-doc-id' });
        expect(mockMoodleRoomModel.deleteOne).toHaveBeenCalledWith({ _id: 'room-301-doc-id' });

        // Verify that ONLY the deleted course (301) room is destroyed on Matrix
        const deleteCalls = fetchCalls.filter(c => c.url.includes('/send/') && c.body?.body?.includes('!admin rooms delete'));
        expect(deleteCalls).toHaveLength(1);
        expect(deleteCalls[0].body.body).toContain('!admin rooms delete --force !room-301:matrix.test');
        expect(deleteCalls[0].body.body).not.toContain('!room-101:matrix.test');

        // Verify members of room 301 are kicked first
        const kickCalls = fetchCalls.filter(c => c.url.includes('/rooms/!room-301%3Amatrix.test/kick'));
        expect(kickCalls).toHaveLength(1);
        expect(kickCalls[0].body.user_id).toBe('@student1:matrix.test');

        // Verify bot left room 301
        const leaveCalls = fetchCalls.filter(c => c.url.includes('/rooms/!room-301%3Amatrix.test/leave'));
        expect(leaveCalls).toHaveLength(1);
    });
});
