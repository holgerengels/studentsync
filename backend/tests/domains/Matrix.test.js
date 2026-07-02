const Matrix = require('../../src/students/domains/Matrix');
const MatrixTeacher = require('../../src/teachers/domains/MatrixTeacher');
const { registerDomain, clearRegistry } = require('../../src/domains/registry');

// Mock mongoose to return mock data for find(), updateOne(), and deleteOne()
jest.mock('mongoose', () => {
    const original = jest.requireActual('mongoose');
    const mockMatrixModel = {
        find: jest.fn().mockImplementation(function (query) {
            const category = query?.category;
            const allData = [
                { userId: 'mustermann.max', firstName: 'Max', lastName: 'Mustermann', login: 'mustermann.max', category: 'students' },
                { userId: 'JS', firstName: 'Jane', lastName: 'Smith', login: 'jane.smith', category: 'teachers' }
            ];
            const filtered = category ? allData.filter(d => d.category === category) : allData;
            this.lean = jest.fn().mockResolvedValue(filtered);
            return this;
        }),
        updateOne: jest.fn().mockResolvedValue({}),
        deleteOne: jest.fn().mockResolvedValue({})
    };

    return {
        ...original,
        connect: jest.fn().mockResolvedValue(null),
        connection: { readyState: 0, close: jest.fn() },
        model: jest.fn().mockReturnValue(mockMatrixModel),
        models: { MatrixIdentity: mockMatrixModel }
    };
});

describe('Matrix Domains (Students & Teachers)', () => {
    let originalFetch;
    let mockFetch;

    beforeAll(() => {
        originalFetch = global.fetch;
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    beforeEach(() => {
        mockFetch = jest.fn();
        global.fetch = mockFetch;

        // Reset domain internal states
        Matrix.adminToken = null;
        Matrix.tokenTime = 0;
        MatrixTeacher.adminToken = null;
        MatrixTeacher.tokenTime = 0;

        clearRegistry();
    });

    it('should login admin successfully and cache token', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: 'valid-token' })
        });

        const token = await Matrix.ensureAdminToken();
        expect(token).toBe('valid-token');
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Second call should return cached token without calling fetch again
        const token2 = await Matrix.ensureAdminToken();
        expect(token2).toBe('valid-token');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should register admin and login if initial login fails (self-healing)', async () => {
        // 1. Login fails
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 403,
            statusText: 'Forbidden'
        });
        // 2. Nonce request succeeds
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ nonce: 'nonce-123' })
        });
        // 3. Register request succeeds
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ user_id: '@synx.admin:matrix.valckenburgschule.de' })
        });
        // 4. Second login succeeds
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: 'registered-token' })
        });

        const token = await Matrix.ensureAdminToken();
        expect(token).toBe('registered-token');
        expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should separate students and teachers correctly in readIdentities', async () => {
        // Register mock Schulkonsole teacher domain
        const mockSkTeacher = {
            domainName: 'schulkonsole-teacher',
            getIdentities: jest.fn().mockResolvedValue([
                { userId: 'JS', login: 'jane.smith', firstName: 'Jane', lastName: 'Smith' }
            ])
        };
        registerDomain(mockSkTeacher);

        // Fetch users response
        mockFetch.mockImplementation(async (url, options) => {
            if (url.includes('/login')) {
                return {
                    ok: true,
                    json: async () => ({ access_token: 'valid-token' })
                };
            }
            if (url.includes('/users')) {
                return {
                    ok: true,
                    json: async () => ({
                        users: [
                            { name: '@jane.smith:matrix.valckenburgschule.de', displayname: 'Jane Smith' },
                            { name: '@mustermann.max:matrix.valckenburgschule.de', displayname: 'Max Mustermann' },
                            { name: '@otheruser:matrix.valckenburgschule.de', displayname: 'Other User' },
                            { name: '@synx.admin:matrix.valckenburgschule.de', displayname: 'Admin' }
                        ],
                        next_token: null
                    })
                };
            }
            return { ok: false, status: 404 };
        });

        // 1. Test Matrix Students Domain
        const studentIdentities = await Matrix.readIdentities();
        expect(studentIdentities).toHaveLength(1);
        expect(studentIdentities[0].userId).toBe('mustermann.max');
        expect(studentIdentities[0].firstName).toBe('Max');
        expect(studentIdentities[0].lastName).toBe('Mustermann');

        // 2. Test Matrix Teachers Domain
        registerDomain(mockSkTeacher);
        const teacherIdentities = await MatrixTeacher.readIdentities();
        expect(teacherIdentities).toHaveLength(1);
        expect(teacherIdentities[0].userId).toBe('JS');
        expect(teacherIdentities[0].firstName).toBe('Jane');
        expect(teacherIdentities[0].lastName).toBe('Smith');
        expect(teacherIdentities[0].login).toBe('jane.smith');
    });

    it('should add, change, and remove identities via admin API', async () => {
        mockFetch.mockImplementation(async (url, options) => {
            if (url.includes('/login')) {
                return { ok: true, json: async () => ({ access_token: 'valid-token' }) };
            }
            if (url.includes('/register') && options?.method === 'POST') {
                return { ok: true, json: async () => ({ user_id: '@jane.smith:matrix.valckenburgschule.de' }) };
            }
            if (url.includes('/register') && !options?.method) {
                return { ok: true, json: async () => ({ nonce: 'nonce-value' }) };
            }
            if (url.includes('/users/') && options?.method === 'PUT') {
                return { ok: true, json: async () => ({}) };
            }
            if (url.includes('/deactivate/') && options?.method === 'POST') {
                return { ok: true, json: async () => ({}) };
            }
            return { ok: false, status: 404 };
        });

        // Add
        const newTeacher = { userId: 'JS', login: 'jane.smith', firstName: 'Jane', lastName: 'Smith' };
        await MatrixTeacher.addIdentity(newTeacher);

        // Change
        const updatedTeacher = { userId: 'JS', login: 'jane.smith', firstName: 'Jane', lastName: 'Smith-Doe' };
        await MatrixTeacher.changeIdentity(updatedTeacher);

        // Remove
        await MatrixTeacher.removeIdentity(newTeacher);

        // Verifications
        const registerCall = mockFetch.mock.calls.find(c => c[0].includes('/register') && c[1]?.method === 'POST');
        const updateCalls = mockFetch.mock.calls.filter(c => c[0].includes('/users/') && c[1]?.method === 'PUT');
        const deactivateCall = mockFetch.mock.calls.find(c => c[0].includes('/deactivate/') && c[1]?.method === 'POST');

        expect(registerCall).toBeDefined();
        expect(JSON.parse(registerCall[1].body).username).toBe('jane.smith');

        expect(updateCalls).toHaveLength(2);
        expect(JSON.parse(updateCalls[0][1].body).displayname).toBe('Jane Smith');
        expect(JSON.parse(updateCalls[1][1].body).displayname).toBe('Jane Smith-Doe');

        expect(deactivateCall).toBeDefined();
        expect(deactivateCall[0]).toContain(encodeURIComponent('@jane.smith:matrix.valckenburgschule.de'));
    });
});
