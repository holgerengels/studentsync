const SyncTask = require('../../src/tasks/SyncTask');
const { createMockDomains } = require('../helpers/mockSetup');

// Mock config to disable devMode so full syncs work in tests
jest.mock('../../src/config', () => ({
    settings: { devMode: false }
}));

describe('SyncTask', () => {
    let mocks;

    beforeEach(() => {
        mocks = createMockDomains();
        // Start with empty target
        mocks.dummy.data = [];
        mocks.dummy.invalidate();
    });

    it('should sync additions to target domain', async () => {
        // Source has 2 users, target is empty
        mocks.dummy.data = [];
        const sourceDomain = mocks.asv;
        const sourceCount = (await sourceDomain.getIdentities()).length;

        const task = new SyncTask('asv', 'dummy');
        const report = await task.execute({ forceRefresh: true });

        expect(report.syncLog.added).toHaveLength(sourceCount);
        expect(report.devMode).toBe(false);

        // Verify target now has same count
        mocks.dummy.invalidate();
        const targetData = await mocks.dummy.getIdentities();
        expect(targetData.length).toBe(sourceCount);
    });

    it('should sync changes to target domain', async () => {
        // Pre-populate target with source data (only users with userId), then modify one entry
        const sourceData = (await mocks.asv.getIdentities()).filter(d => d.userId);
        mocks.dummy.data = sourceData.map(d => ({ ...d }));
        mocks.dummy.data[0] = { ...mocks.dummy.data[0], firstName: 'WRONG_NAME' };
        mocks.dummy.invalidate();

        const task = new SyncTask('asv', 'dummy');
        const report = await task.execute({ forceRefresh: true });

        expect(report.syncLog.changed).toHaveLength(1);
        expect(report.syncLog.removed).toBeUndefined();

        // Verify the name was corrected
        mocks.dummy.invalidate();
        const targetData = await mocks.dummy.getIdentities();
        const corrected = targetData.find(u => u.userId === sourceData[0].userId);
        expect(corrected.firstName).toBe(sourceData[0].firstName);
    });

    it('should sync removals from target domain', async () => {
        // Target has an extra user not in source
        const sourceData = await mocks.asv.getIdentities();
        mocks.dummy.data = [...sourceData.map(d => ({ ...d })), { userId: 'ghost_extra', firstName: 'Ghost', lastName: 'User' }];
        mocks.dummy.invalidate();

        const task = new SyncTask('asv', 'dummy');
        const report = await task.execute({ forceRefresh: true });

        expect(report.syncLog.removed).toHaveLength(1);
        expect(report.syncLog.removed).toContain('ghost_extra');

        mocks.dummy.invalidate();
        const targetData = await mocks.dummy.getIdentities();
        expect(targetData.find(u => u.userId === 'ghost_extra')).toBeUndefined();
    });

    it('should handle mixed add/change/remove in one sync', async () => {
        const sourceData = await mocks.asv.getIdentities();
        // Target: missing first user (→ add), has wrong name for second (→ change), has extra ghost (→ remove)
        const targetData = sourceData.slice(1).map(d => ({ ...d }));
        targetData[0] = { ...targetData[0], lastName: 'FALSCHER_NAME' };
        targetData.push({ userId: 'to_remove', firstName: 'Old', lastName: 'Ghost' });
        mocks.dummy.data = targetData;
        mocks.dummy.invalidate();

        const task = new SyncTask('asv', 'dummy');
        const report = await task.execute({ forceRefresh: true });

        expect(report.syncLog.added.length).toBeGreaterThanOrEqual(1);
        expect(report.syncLog.changed.length).toBeGreaterThanOrEqual(1);
        expect(report.syncLog.removed).toContain('to_remove');
    });

    it('should fail if target domain is not managable', async () => {
        const Domain = require('../../src/domains/Domain');
        const { registerDomain } = require('../../src/domains/registry');
        class ReadOnlyDomain extends Domain {
            async readIdentities() { return []; }
        }
        registerDomain(new ReadOnlyDomain('readonly'));

        const task = new SyncTask('asv', 'readonly');
        await expect(task.execute()).rejects.toThrow('not managable');
    });

    it('format() produces correct HTML output', () => {
        const task = new SyncTask('asv', 'dummy');
        const report = {
            syncLog: { added: ['u1', 'u2'], changed: ['u3'], removed: [] },
            devMode: false
        };
        const html = task.format(report);
        expect(html).toContain('Added: 2');
        expect(html).toContain('Changed: 1');
        expect(html).toContain('Removed: 0');
        expect(html).not.toContain('DEV MODE');
    });

    it('format() shows devMode indicator', () => {
        const task = new SyncTask('asv', 'dummy');
        const report = {
            syncLog: { added: ['u1'] },
            devMode: true
        };
        const html = task.format(report);
        expect(html).toContain('DEV MODE');
    });
});
