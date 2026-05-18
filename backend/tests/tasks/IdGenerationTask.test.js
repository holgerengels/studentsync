const task = require('../../src/students/tasks/IdGenerationTask');
const { createMockDomains } = require('../helpers/mockSetup');

// Disable devMode so full operations work in tests
jest.mock('../../src/config', () => ({
    settings: { devMode: false }
}));

describe('IdGenerationTask', () => {
    let mocks;

    beforeEach(() => {
        mocks = createMockDomains();
    });

    test('execute generates IDs for students without userId', async () => {
        // The ASV mock data has 1 student without userId (index 0: Leon Müller)
        const result = await task.execute();

        expect(result.details.added.length).toBeGreaterThanOrEqual(1);
        expect(result.details.added[0].id).toBeTruthy();
        expect(result.details.added[0].new.firstName).toBe('Leon');
        expect(result.devMode).toBe(false);
    });

    test('execute returns empty when all students have IDs', async () => {
        // Give every student a userId
        for (const user of mocks.asv.data) {
            if (!user.userId) user.userId = 'pre_assigned_' + user.id;
        }
        mocks.asv.invalidate();

        const result = await task.execute();

        expect(result.details.added).toHaveLength(0);
        expect(result.details.totalMissing).toBe(0);
    });

    test('format formats output with count', () => {
        const summary = task.format({
            details: {
                added: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
                totalMissing: 3
            },
            devMode: false
        });
        expect(summary).toContain('+3/3 IDs generiert');
        expect(summary).not.toContain('DEV MODE');
    });

    test('format shows devMode suffix', () => {
        const summary = task.format({
            details: {
                added: [{ id: 'a' }],
                totalMissing: 5
            },
            devMode: true
        });
        expect(summary).toContain('+1/5 IDs generiert');
        expect(summary).toContain('[DEV MODE LIMIT]');
    });

    test('format handles empty and error cases', () => {
        expect(task.format(null)).toBe('-');
        expect(task.format({ details: { added: [], totalMissing: 0 }, devMode: false }))
            .toContain('Keine neuen IDs notwendig');
    });
});
