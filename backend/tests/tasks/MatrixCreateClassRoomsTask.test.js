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

    /**
     * Helper: creates a mockFetch that handles teachers space resolution/creation,
     * class alias resolution, room creation, joins, kicks, and the new endpoints
     * (join_rules, directory/list).
     */
    function createMockFetch(overrides = {}) {
        const teachersSpaceId = overrides.teachersSpaceId || '!teachers:matrix.valckenburgschule.de';
        let teachersSpaceCreated = false;

        return async (url, options) => {
            // Teachers space alias resolution
            if (url.includes('/directory/room/%23teachers')) {
                if (overrides.teachersSpaceExists || teachersSpaceCreated) {
                    return { ok: true, json: async () => ({ room_id: teachersSpaceId }) };
                }
                return { ok: false, status: 404 };
            }
            // Admin room alias resolution
            if (url.includes('/directory/room/%23admins')) {
                return { ok: false, status: 404 };
            }
            // Room creation (teachers space or class space)
            if (url.includes('/createRoom')) {
                const body = JSON.parse(options.body);
                if (body.room_alias_name === 'teachers') {
                    teachersSpaceCreated = true;
                    return { ok: true, json: async () => ({ room_id: teachersSpaceId }) };
                }
                const roomId = overrides.createdRoomId || '!room10a:matrix.valckenburgschule.de';
                return { ok: true, json: async () => ({ room_id: roomId }) };
            }
            // Join rules state event
            if (url.includes('/state/m.room.join_rules')) {
                return { ok: true, json: async () => ({}) };
            }
            // Directory visibility
            if (url.includes('/directory/list/room/')) {
                return { ok: true, json: async () => ({}) };
            }
            // Power levels
            if (url.includes('/state/m.room.power_levels')) {
                if (options?.method === 'PUT') {
                    return { ok: true, json: async () => ({}) };
                }
                return { ok: true, json: async () => ({ users: {} }) };
            }
            // Joined members
            if (url.includes('/joined_members')) {
                const members = overrides.joinedMembers || {};
                return { ok: true, json: async () => ({ joined: members }) };
            }
            // Kick
            if (url.includes('/kick')) {
                return { ok: true, json: async () => ({}) };
            }
            // Delete
            if (options?.method === 'DELETE') {
                return { ok: true, json: async () => ({}) };
            }
            // Force-joins (Synapse Admin API)
            if (url.includes('/join/')) {
                return { ok: true, json: async () => ({}) };
            }

            // Class alias resolution - delegate to overrides
            if (overrides.resolveAlias) {
                const result = overrides.resolveAlias(url, options);
                if (result !== undefined) return result;
            }

            return { ok: false, status: 404 };
        };
    }

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

        // 2. Mock matrix-teacher domain with one teacher
        const mockMatrixTeacher = {
            domainName: 'matrix-teacher',
            getIdentities: jest.fn().mockResolvedValue([
                { userId: 'JS', firstName: 'Jane', lastName: 'Smith', login: 'jane.smith' }
            ]),
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
        mockFetch.mockImplementation(createMockFetch({
            resolveAlias: (url) => {
                if (url.includes('/directory/room/%23class_10a')) {
                    return { ok: false, status: 404 };
                }
            }
        }));

        const task = new MatrixCreateClassRoomsTask();
        const report = await task.execute();

        expect(report.success).toBe(true);
        expect(report.devMode).toBe(true);
        expect(report.details.created).toEqual(['10A']); // only 10A processed because of DevMode limit
        expect(report.details.deleted).toEqual(['10C']); // 10C obsolete room deleted
        expect(report.details.errors).toEqual([]);

        // Verify class space creation uses visibility: public and knock_restricted
        const createCalls = mockFetch.mock.calls.filter(c => c[0].includes('/createRoom'));
        const classCreateCall = createCalls.find(c => {
            const body = JSON.parse(c[1].body);
            return body.room_alias_name === 'class_10a';
        });
        expect(classCreateCall).toBeDefined();
        const classCreateBody = JSON.parse(classCreateCall[1].body);
        expect(classCreateBody.visibility).toBe('public');
        expect(classCreateBody.preset).toBeUndefined();
        expect(classCreateBody.initial_state).toBeDefined();
        const joinRulesState = classCreateBody.initial_state.find(s => s.type === 'm.room.join_rules');
        expect(joinRulesState.content.join_rule).toBe('knock_restricted');
        expect(joinRulesState.content.allow).toEqual([{
            type: 'm.room_membership',
            room_id: '!teachers:matrix.valckenburgschule.de'
        }]);

        // Verify teachers space was created (private)
        const teachersCreateCall = createCalls.find(c => {
            const body = JSON.parse(c[1].body);
            return body.room_alias_name === 'teachers';
        });
        expect(teachersCreateCall).toBeDefined();
        const teachersCreateBody = JSON.parse(teachersCreateCall[1].body);
        expect(teachersCreateBody.visibility).toBe('private');
        expect(teachersCreateBody.preset).toBe('private_chat');

        // Verify join calls include teacher being joined to teachers space
        const joinCalls = mockFetch.mock.calls.filter(c => c[0].includes('/join/'));
        const joinedUsers = joinCalls.map(c => decodeURIComponent(c[0].split('/join/')[1]));
        expect(joinedUsers).toContain('@max.mustermann:matrix.valckenburgschule.de');
        expect(joinedUsers).toContain('@erika.muster:matrix.valckenburgschule.de');
        expect(joinedUsers).toContain('@jane.smith:matrix.valckenburgschule.de');
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
            getIdentities: jest.fn().mockResolvedValue([
                { userId: 'JS', firstName: 'Jane', lastName: 'Smith', login: 'jane.smith' }
            ]),
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

        mockFetch.mockImplementation(createMockFetch({
            resolveAlias: (url) => {
                if (url.includes('/directory/room/%23class_10a')) {
                    return { ok: false, status: 404 };
                }
                if (url.includes('/directory/room/%23class_10b')) {
                    return { ok: true, json: async () => ({ room_id: '!room10b:matrix.valckenburgschule.de' }) };
                }
            }
        }));

        const task = new MatrixCreateClassRoomsTask();
        const report = await task.execute();

        expect(report.success).toBe(true);
        expect(report.devMode).toBe(false);
        expect(report.details.created).toEqual(['10A']); // only 10A created (10B was already resolved)
        expect(report.details.deleted).toEqual(['10C']);
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
                { userId: 'new.student', clazz: '10A' },
                { userId: 'old.student', clazz: '10B' }
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
            // Teachers space alias resolution (exists)
            if (url.includes('/directory/room/%23teachers')) {
                return { ok: true, json: async () => ({ room_id: '!teachers:matrix.valckenburgschule.de' }) };
            }
            // Admin room alias resolution
            if (url.includes('/directory/room/%23admins')) {
                return { ok: false, status: 404 };
            }
            // Room exists
            if (url.includes('/directory/room/%23class_10a')) {
                return { ok: true, json: async () => ({ room_id: '!room10a:matrix.valckenburgschule.de' }) };
            }
            // Join rules state event
            if (url.includes('/state/m.room.join_rules')) {
                return { ok: true, json: async () => ({}) };
            }
            // Directory visibility
            if (url.includes('/directory/list/room/')) {
                return { ok: true, json: async () => ({}) };
            }
            // Power levels
            if (url.includes('/state/m.room.power_levels')) {
                if (options?.method === 'PUT') {
                    return { ok: true, json: async () => ({}) };
                }
                return { ok: true, json: async () => ({ users: {} }) };
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
        expect(joinedUsers).toContain('@new.student:matrix.valckenburgschule.de');
    });
});
