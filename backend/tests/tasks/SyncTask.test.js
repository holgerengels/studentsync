const SyncTask = require('../../src/tasks/SyncTask');
const ManagableDomain = require('../../src/domains/ManagableDomain');
const { registerDomain } = require('../../src/domains/registry');

const mongoose = require('mongoose');
const DummyDomain = require('../../src/domains/DummyDomain');

// 2. A mock source domain that we control
class MockSourceDomain extends ManagableDomain {
    constructor() {
        super('dummy-source');
        this.data = [];
    }
    async readIdentities() {
        return this.data;
    }
}

describe('SyncTask', () => {
    let sourceDomain;
    let targetDomain;
    let syncTask;

    beforeAll(async () => {
        await mongoose.connect('mongodb://admin:password@localhost:27017/synx_tests?authSource=admin');
        sourceDomain = new MockSourceDomain();
        targetDomain = new DummyDomain();
        registerDomain(sourceDomain);
        registerDomain(targetDomain);
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        const DummyModel = mongoose.model('DummyIdentity');
        await DummyModel.deleteMany({});
        sourceDomain.data = [];
        targetDomain.invalidate();
        sourceDomain.invalidate();
        syncTask = new SyncTask('dummy-source', 'dummy'); 
    });

    it('should sync additions to dummy domain', async () => {
        sourceDomain.data = [
            { userId: 'user1', firstName: 'Alice', lastName: 'Smith' },
            { userId: 'user2', firstName: 'Bob', lastName: 'Jones' }
        ];

        const report = await syncTask.execute();

        expect(report.syncLog.added).toHaveLength(2);
        expect(report.syncLog.added).toContain('user1');
        expect(report.syncLog.added).toContain('user2');
        expect(report.syncLog.changed).toBeUndefined();
        expect(report.syncLog.removed).toBeUndefined();

        // Verify target database has them
        const targetIdentities = await targetDomain.getIdentities();
        expect(targetIdentities.length).toBe(2);
    });

    it('should sync changes to dummy domain', async () => {
        const DummyModel = mongoose.model('DummyIdentity');
        await DummyModel.create({ userId: 'user1', firstName: 'Alice', lastName: 'OldLastName' });
        
        sourceDomain.data = [
            { userId: 'user1', firstName: 'Alice', lastName: 'NewLastName' }
        ];

        const report = await syncTask.execute();

        expect(report.syncLog.changed).toHaveLength(1);
        expect(report.syncLog.changed).toContain('user1');
        expect(report.syncLog.added).toBeUndefined();
        expect(report.syncLog.removed).toBeUndefined();

        const targetIdentities = await targetDomain.getIdentities();
        expect(targetIdentities[0].lastName).toBe('NewLastName');
    });

    it('should sync removals from dummy domain', async () => {
        const DummyModel = mongoose.model('DummyIdentity');
        await DummyModel.create({ userId: 'user1', firstName: 'Alice', lastName: 'Smith' });
        await DummyModel.create({ userId: 'user2', firstName: 'Bob', lastName: 'Jones' });
        
        // user2 is missing in source
        sourceDomain.data = [
            { userId: 'user1', firstName: 'Alice', lastName: 'Smith' }
        ];

        const report = await syncTask.execute();

        expect(report.syncLog.removed).toHaveLength(1);
        expect(report.syncLog.removed).toContain('user2');
        expect(report.syncLog.added).toBeUndefined();
        expect(report.syncLog.changed).toBeUndefined();

        const targetIdentities = await targetDomain.getIdentities();
        expect(targetIdentities.length).toBe(1);
        expect(targetIdentities[0].userId).toBe('user1');
    });

    it('should fail if trying to sync to a non-managable target', async () => {
        const NonManagableDomain = require('../../src/domains/Domain');
        class BadTargetDomain extends NonManagableDomain {
            async readIdentities() { return []; }
        }
        const badTarget = new BadTargetDomain('bad-target');
        registerDomain(badTarget);

        const badSyncTask = new SyncTask('dummy-source', 'bad-target');
        
        await expect(badSyncTask.execute()).rejects.toThrow('Target domain bad-target is not managable');
    });
});
