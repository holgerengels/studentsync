const MatrixReconcileUsersTask = require('../../src/students/tasks/MatrixReconcileUsersTask');
const { registerDomain, clearRegistry } = require('../../src/domains/registry');
const config = require('../../src/config');
const mongoose = require('mongoose');

var mockMatrixModel;
const mockClassroomModel = {}; // Dummy

jest.mock('mongoose', () => {
    const original = jest.requireActual('mongoose');
    mockMatrixModel = {
        find: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
            { _id: 'user1', userId: 'user.exists', login: 'user.exists', category: 'students' },
            { _id: 'user2', userId: 'user.missing', login: 'user.missing', category: 'students' }
        ]),
        deleteOne: jest.fn().mockResolvedValue({})
    };
    return {
        ...original,
        connect: jest.fn().mockResolvedValue(null),
        connection: { readyState: 0, close: jest.fn() },
        model: jest.fn((name) => {
            if (name === 'MatrixIdentity') return mockMatrixModel;
            return mockClassroomModel;
        }),
        models: {
            MatrixIdentity: mockMatrixModel
        }
    };
});

describe('MatrixReconcileUsersTask', () => {
    let mockFetch;

    beforeEach(() => {
        clearRegistry();
        mockFetch = jest.fn();
        global.fetch = mockFetch;
        jest.clearAllMocks();
        config.settings = config.settings || {};
    });

    it('should reconcile users by deleting missing users and keeping existing ones', async () => {
        config.settings.devMode = false;

        // 1. Mock Matrix domain
        const mockMatrix = {
            domainName: 'matrix',
            homeserverUrl: 'https://matrix.valckenburgschule.de'
        };
        registerDomain(mockMatrix);

        // 2. Mock fetch responses
        mockFetch.mockImplementation(async (url) => {
            if (url.includes('username=user.exists')) {
                // Returns 400 (M_USER_IN_USE) -> exists
                return {
                    status: 400,
                    text: async () => 'M_USER_IN_USE'
                };
            }
            if (url.includes('username=user.missing')) {
                // Returns 200 -> available (does not exist)
                return {
                    status: 200,
                    text: async () => '{"available":true}'
                };
            }
            return { status: 404, text: async () => 'Not Found' };
        });

        const task = new MatrixReconcileUsersTask();
        const report = await task.execute();

        expect(report.success).toBe(true);
        expect(report.details.checked).toBe(2);
        expect(report.details.valid).toBe(1);
        expect(report.details.deleted).toBe(1);
        expect(report.details.deletedUsers).toEqual(['user.missing']);

        // Verify deleteOne was called for the missing user
        expect(mockMatrixModel.deleteOne).toHaveBeenCalledTimes(1);
        expect(mockMatrixModel.deleteOne).toHaveBeenCalledWith({ _id: 'user2' });
    });
});
