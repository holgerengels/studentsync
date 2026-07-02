const MatrixCreateClassRoomsTask = require('../../src/students/tasks/MatrixCreateClassRoomsTask');
const { registerDomain, clearRegistry } = require('../../src/domains/registry');
const config = require('../../src/config');
const mongoose = require('mongoose');
const ClassroomModel = mongoose.model('Classroom');

// Mock mongoose to return mock data for find(), updateOne(), and deleteOne()
jest.mock('mongoose', () => {
    const original = jest.requireActual('mongoose');
    const mockClassroomModel = {
        find: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
            { _id: 'room-10c-id', className: '10C', roomId: '!room10c:matrix.valckenburgschule.de' }
        ]),
        updateOne: jest.fn().mockResolvedValue({}),
        deleteOne: jest.fn().mockResolvedValue({})
    };

    return {
        ...original,
        connect: jest.fn().mockResolvedValue(null),
        connection: { readyState: 0, close: jest.fn() },
        model: jest.fn().mockReturnValue(mockClassroomModel),
        models: { Classroom: mockClassroomModel }
    };
});

describe('MatrixCreateClassRoomsTask', () => {
    let originalFetch;
    let mockFetch;
    let originalClassTeachers;
    let originalDevMode;

    beforeAll(() => {
        originalFetch = global.fetch;
        originalClassTeachers = config.classTeachers;
        originalDevMode = config.settings?.devMode;
    });

    afterAll(() => {
        global.fetch = originalFetch;
        config.classTeachers = originalClassTeachers;
        if (config.settings) {
            config.settings.devMode = originalDevMode;
        }
    });

    beforeEach(() => {
        mockFetch = jest.fn();
        global.fetch = mockFetch;
        clearRegistry();
        jest.clearAllMocks();

        config.classTeachers = {
            '10A': 'JS'
        };
        config.settings = config.settings || {};
    });

    it('should create rooms and join members respecting devMode limits', async () => {
        // DevMode is active
        config.settings.devMode = true;

        // 1. Mock matrix domain
        const mockMatrix = {
            domainName: 'matrix',
            homeserverUrl: 'https://matrix.valckenburgschule.de',
            homeserverDomainName: 'matrix.valckenburgschule.de',
            ensureAdminToken: jest.fn().mockResolvedValue('admin-token')
        };
        registerDomain(mockMatrix);

        // 2. Mock matrix-teacher domain
        const mockMatrixTeacher = {
            domainName: 'matrix-teacher',
            getIdentities: jest.fn().mockResolvedValue([]),
            initialsToLogin: new Map([['js', 'jane.smith']])
        };
        registerDomain(mockMatrixTeacher);

        // 3. Mock schulkonsole domain
        const mockSchulkonsole = {
            domainName: 'schulkonsole',
            getIdentities: jest.fn().mockResolvedValue([
                { userId: 'max.mustermann', clazz: '10A' },
                { userId: 'erika.muster', clazz: '10A' },
                { userId: 'other.student', clazz: '10B' }
            ])
        };
        registerDomain(mockSchulkonsole);

        // 4. Mock fetch endpoints
        mockFetch.mockImplementation(async (url, options) => {
            if (url.includes('/joined_members')) {
                return { ok: true, json: async () => ({ joined: {} }) };
            }
            if (url.includes('/kick')) {
                return { ok: true, json: async () => ({}) };
            }
            // Room alias resolution for class 10a (not found)
            if (url.includes('/directory/room/%23class_10a')) {
                return { ok: false, status: 404 };
            }
            // Room creation
            if (options?.method === 'DELETE') {
                return { ok: true, json: async () => ({}) };
            }
            // Room creation
            if (url.includes('/createRoom')) {
                return { ok: true, json: async () => ({ room_id: '!room10a:matrix.valckenburgschule.de' }) };
            }
            // Force-joins
            if (url.includes('/join/')) {
                return { ok: true, json: async () => ({}) };
            }
            return { ok: false, status: 404 };
        });

        const task = new MatrixCreateClassRoomsTask();
        const report = await task.execute();

        expect(report.success).toBe(true);
        expect(report.devMode).toBe(true);
        expect(report.details.created).toEqual(['10A']); // only 10A processed because of DevMode limit
        expect(report.details.deleted).toEqual(['10C']); // 10C obsolete room deleted
        expect(report.details.joined).toBe(3); // 2 students + 1 teacher
        expect(report.details.errors).toEqual([]);

        // Verify calls
        const createCall = mockFetch.mock.calls.find(c => c[0].includes('/createRoom'));
        expect(createCall).toBeDefined();
        expect(JSON.parse(createCall[1].body).room_alias_name).toBe('class_10a');

        const joinCalls = mockFetch.mock.calls.filter(c => c[0].includes('/join/'));
        expect(joinCalls).toHaveLength(3);
        const joinedUsers = joinCalls.map(c => decodeURIComponent(c[0].split('/join/')[1]));
        expect(joinedUsers).toContain('@max.mustermann:matrix.valckenburgschule.de');
        expect(joinedUsers).toContain('@erika.muster:matrix.valckenburgschule.de');
        expect(joinedUsers).toContain('@jane.smith:matrix.valckenburgschule.de');
        
        joinCalls.forEach(c => {
            expect(JSON.parse(c[1].body).room_id_or_alias).toBe('!room10a:matrix.valckenburgschule.de');
        });
    });

    it('should process all classes when devMode is inactive', async () => {
        // DevMode is inactive
        config.settings.devMode = false;

        const mockMatrix = {
            domainName: 'matrix',
            homeserverUrl: 'https://matrix.valckenburgschule.de',
            homeserverDomainName: 'matrix.valckenburgschule.de',
            ensureAdminToken: jest.fn().mockResolvedValue('admin-token')
        };
        registerDomain(mockMatrix);

        const mockMatrixTeacher = {
            domainName: 'matrix-teacher',
            getIdentities: jest.fn().mockResolvedValue([]),
            initialsToLogin: new Map([['js', 'jane.smith']])
        };
        registerDomain(mockMatrixTeacher);

        const mockSchulkonsole = {
            domainName: 'schulkonsole',
            getIdentities: jest.fn().mockResolvedValue([
                { userId: 'max.mustermann', clazz: '10A' },
                { userId: 'other.student', clazz: '10B' }
            ])
        };
        registerDomain(mockSchulkonsole);

        mockFetch.mockImplementation(async (url, options) => {
            if (url.includes('/joined_members')) {
                return { ok: true, json: async () => ({ joined: {} }) };
            }
            if (url.includes('/kick')) {
                return { ok: true, json: async () => ({}) };
            }
            if (options?.method === 'DELETE') {
                return { ok: true, json: async () => ({}) };
            }
            if (url.includes('/directory/room/%23class_10a')) {
                return { ok: false, status: 404 };
            }
            if (url.includes('/directory/room/%23class_10b')) {
                return { ok: true, json: async () => ({ room_id: '!room10b:matrix.valckenburgschule.de' }) };
            }
            if (url.includes('/createRoom')) {
                return { ok: true, json: async () => ({ room_id: '!room10a:matrix.valckenburgschule.de' }) };
            }
            if (url.includes('/join/')) {
                return { ok: true, json: async () => ({}) };
            }
            return { ok: false, status: 404 };
        });

        const task = new MatrixCreateClassRoomsTask();
        const report = await task.execute();

        expect(report.success).toBe(true);
        expect(report.devMode).toBe(false);
        expect(report.details.created).toEqual(['10A']); // only 10A created (10B was already resolved)
        expect(report.details.deleted).toEqual(['10C']);
        expect(report.details.joined).toBe(3); // 10A (1 student + 1 teacher) + 10B (1 student) = 3 members joined
    });

    it('should synchronize room members by kicking left members and joining new members', async () => {
        // DevMode is inactive
        config.settings.devMode = false;

        const mockMatrix = {
            domainName: 'matrix',
            homeserverUrl: 'https://matrix.valckenburgschule.de',
            homeserverDomainName: 'matrix.valckenburgschule.de',
            ensureAdminToken: jest.fn().mockResolvedValue('admin-token'),
            adminUsername: 'synx.admin'
        };
        registerDomain(mockMatrix);

        const mockMatrixTeacher = {
            domainName: 'matrix-teacher',
            getIdentities: jest.fn().mockResolvedValue([]),
            initialsToLogin: new Map()
        };
        registerDomain(mockMatrixTeacher);

        const mockSchulkonsole = {
            domainName: 'schulkonsole',
            getIdentities: jest.fn().mockResolvedValue([
                { userId: 'new.student', clazz: '10A' }
            ])
        };
        registerDomain(mockSchulkonsole);

        // Mock classroom cache in MongoDB
        ClassroomModel.lean.mockResolvedValue([
            { className: '10A', roomId: '!room10a:matrix.valckenburgschule.de' }
        ]);

        const kickedUsers = [];
        const joinedUsers = [];

        mockFetch.mockImplementation(async (url, options) => {
            // Room exists
            if (url.includes('/directory/room/%23class_10a')) {
                return { ok: true, json: async () => ({ room_id: '!room10a:matrix.valckenburgschule.de' }) };
            }
            // Mock joined members: synx.admin, old.student (who has left class 10A)
            if (url.includes('/joined_members')) {
                return {
                    ok: true,
                    json: async () => ({
                        joined: {
                            '@synx.admin:matrix.valckenburgschule.de': {},
                            '@old.student:matrix.valckenburgschule.de': {}
                        }
                    })
                };
            }
            // Mock kick
            if (url.includes('/kick')) {
                const body = JSON.parse(options.body);
                kickedUsers.push(body.user_id);
                return { ok: true, json: async () => ({}) };
            }
            // Mock join
            if (url.includes('/join/')) {
                const user = decodeURIComponent(url.split('/join/')[1]);
                joinedUsers.push(user);
                return { ok: true, json: async () => ({}) };
            }
            return { ok: false, status: 404 };
        });

        const task = new MatrixCreateClassRoomsTask();
        const report = await task.execute();

        expect(report.success).toBe(true);
        expect(report.details.joined).toBe(1);
        expect(report.details.kicked).toBe(1);
        expect(kickedUsers).toEqual(['@old.student:matrix.valckenburgschule.de']);
        expect(joinedUsers).toEqual(['@new.student:matrix.valckenburgschule.de']);
    });
});
