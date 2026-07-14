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
        
        // Math 101 room name should be the custom room name 'Custom Math Room'
        // Physics 101 room name should default to 'Physics 101'
        expect(report.details.roomsCreated).toContain('Custom Math Room');
        expect(report.details.roomsCreated).toContain('Physics 101');
        expect(report.details.roomsCreated).not.toContain('History 101');
        expect(report.details.roomsCreated).not.toContain('Math 101'); // original name should not be used

        // Verify updateOne was called with correctly updated names
        expect(mockMoodleRoomModel.updateOne).toHaveBeenCalledWith(
            { courseId: 101 },
            expect.objectContaining({
                $set: expect.objectContaining({
                    courseName: 'Custom Math Room'
                })
            }),
            { upsert: true }
        );
    });
});
