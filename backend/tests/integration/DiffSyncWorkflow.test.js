const SyncTask = require('../../src/tasks/SyncTask');
const DiffTask = require('../../src/tasks/DiffTask');
const { createMockDomains } = require('../helpers/mockSetup');

// Disable devMode so full syncs work
jest.mock('../../src/config', () => ({
    settings: { devMode: false }
}));

describe('Diff → Sync Workflow (Mock Domains)', () => {
    let mocks;

    beforeEach(() => {
        mocks = createMockDomains();
    });

    it('should perform full sync: add missing, fix changed, remove extras', async () => {
        // Step 1: Populate target (dummy) with source data (only users that have a userId)
        const sourceData = (await mocks.asv.getIdentities()).filter(d => d.userId);
        mocks.dummy.data = sourceData.map(d => ({ ...d }));
        mocks.dummy.invalidate();

        // Step 2: Verify initial state — only users with userId participate in diff
        const diffTask1 = new DiffTask('asv', 'dummy');
        const initialDiff = await diffTask1.execute({ forceRefresh: true });
        // The ASV mock intentionally has one user with userId=null (for ID generation testing)
        // That user shows up as "added" since it has no key match. All others should be synced.
        expect(initialDiff.details.removed).toHaveLength(0);
        expect(initialDiff.details.changed).toHaveLength(0);

        // Step 3: Mutate target — change a name, add a ghost, remove one
        if (mocks.dummy.data.length > 1) {
            mocks.dummy.data[0] = { ...mocks.dummy.data[0], firstName: 'GEÄNDERTER_NAME' };
            mocks.dummy.data.splice(1, 1); // remove second entry
        }
        mocks.dummy.data.push({ userId: 'ghost_fake', firstName: 'Fake', lastName: 'Ghost' });
        mocks.dummy.invalidate();

        // Step 4: Verify diff detects the mutations
        const diffTask2 = new DiffTask('asv', 'dummy');
        const mutatedDiff = await diffTask2.execute({ forceRefresh: true });

        expect(mutatedDiff.details.added.length).toBeGreaterThanOrEqual(1);     // deleted user → re-add
        expect(mutatedDiff.details.changed.length).toBeGreaterThanOrEqual(1);   // wrong name → change
        expect(mutatedDiff.details.removed.length).toBeGreaterThanOrEqual(1);   // ghost → remove

        // Step 5: Run sync to heal the target
        const syncTask = new SyncTask('asv', 'dummy');
        const report = await syncTask.execute({ forceRefresh: true });

        expect(report.details.added.length).toBeGreaterThanOrEqual(1);
        expect(report.details.changed.length).toBeGreaterThanOrEqual(1);
        expect(report.details.removed.map(r => r.id)).toContain('ghost_fake');

        // Step 6: Verify target matches source again (full ASV set including null-userId user)
        mocks.dummy.invalidate();
        const healedData = await mocks.dummy.getIdentities();
        const fullAsvData = await mocks.asv.getIdentities();
        expect(healedData.length).toBe(fullAsvData.length);

        // Ghost user is gone
        expect(healedData.find(u => u.userId === 'ghost_fake')).toBeUndefined();

        // Changed name is restored
        const restored = healedData.find(u => u.userId === sourceData[0].userId);
        expect(restored.firstName).toBe(sourceData[0].firstName);
        expect(restored.firstName).not.toBe('GEÄNDERTER_NAME');
    });

    it('should sync between any two domain mocks', async () => {
        // Sync ASV → Untis mock (untis is missing some users from ASV)
        const syncTask = new SyncTask('asv', 'untis');
        const report = await syncTask.execute({ forceRefresh: true });

        // ASV mock data has users that untis mock doesn't
        expect(report.details.added.length).toBeGreaterThanOrEqual(1);

        // After sync, untis should have at least as many as asv
        mocks.untis.invalidate();
        const asvData = await mocks.asv.getIdentities();
        const untisData = await mocks.untis.getIdentities();
        expect(untisData.length).toBe(asvData.length);
    });

    it('should be idempotent — second sync produces no changes', async () => {
        // First sync
        const task1 = new SyncTask('asv', 'dummy');
        const sourceData = await mocks.asv.getIdentities();
        mocks.dummy.data = [];
        mocks.dummy.invalidate();
        await task1.execute({ forceRefresh: true });

        // Second sync — should produce no changes
        const task2 = new SyncTask('asv', 'dummy');
        const report2 = await task2.execute({ forceRefresh: true });

        expect(report2.details.added).toHaveLength(0);
        expect(report2.details.changed).toHaveLength(0);
        expect(report2.details.removed).toHaveLength(0);
    });
});
