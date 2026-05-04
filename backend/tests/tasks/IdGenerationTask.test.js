const task = require('../../src/tasks/IdGenerationTask');
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

        expect(result.generated.length).toBeGreaterThanOrEqual(1);
        expect(result.generated[0].account).toBeTruthy();
        expect(result.generated[0].firstName).toBe('Leon');
        expect(result.syncLog.generatedIds).toContain(result.generated[0].account);
        expect(result.devMode).toBe(false);
    });

    test('execute returns empty when all students have IDs', async () => {
        // Give every student a userId
        for (const user of mocks.asv.data) {
            if (!user.userId) user.userId = 'pre_assigned_' + user.id;
        }
        mocks.asv.invalidate();

        const result = await task.execute();

        expect(result.generated).toHaveLength(0);
        expect(result.totalMissing).toBe(0);
    });

    test('summarize formats output with count', () => {
        const summary = task.summarize({
            generated: [{ account: 'a' }, { account: 'b' }, { account: 'c' }],
            totalMissing: 3,
            devMode: false
        });
        expect(summary).toContain('+3/3 IDs generiert');
        expect(summary).not.toContain('DEV MODE');
    });

    test('summarize shows devMode suffix', () => {
        const summary = task.summarize({
            generated: [{ account: 'a' }],
            totalMissing: 5,
            devMode: true
        });
        expect(summary).toContain('+1/5 IDs generiert');
        expect(summary).toContain('[DEV MODE LIMIT]');
    });

    test('summarize handles empty and error cases', () => {
        expect(task.summarize(null)).toBe('-');
        expect(task.summarize({ error: 'DB down' })).toContain('Fehler: DB down');
        expect(task.summarize({ generated: [], totalMissing: 0, devMode: false }))
            .toContain('Keine neuen IDs notwendig');
    });
});
