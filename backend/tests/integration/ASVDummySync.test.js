const mongoose = require('mongoose');
const asv = require('../../src/domains/ASV');
const DummyDomain = require('../../src/domains/DummyDomain');
const { registerDomain, clearRegistry } = require('../../src/domains/registry');
const SyncTask = require('../../src/tasks/SyncTask');
const Identity = require('../../src/domains/Identity');

describe('Sync ASV -> Dummy Workflow', () => {
    let dummyDomain;
    let originalEnv;

    beforeAll(async () => {
        // Connect to an isolated test db so we don't mess with dev 
        await mongoose.connect('mongodb://admin:password@localhost:27017/synx_tests?authSource=admin');
        
        clearRegistry();
        
        dummyDomain = new DummyDomain();
        registerDomain(asv);
        registerDomain(dummyDomain);

        // Mock ASV temporarily so this test passes regardless of local postgres availability
        try {
            await asv.getIdentities();
        } catch(e) {
            console.warn("ASV unreachable, injecting mocked identities for workflow test.");
            asv.readIdentities = async () => [
                new Identity('user1', 'Max', 'Mustermann', { clazz: '10A' }),
                new Identity('user2', 'Anna', 'Schmidt', { clazz: '10B' }),
                new Identity('user3', 'Tom', 'Müller', { clazz: '10A' })
            ];
        }

        // Disable DevMode limits so the full sync executes cleanly in test
        originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
    });

    afterAll(async () => {
        await mongoose.connection.close();
        process.env.NODE_ENV = originalEnv;
    });

    test('Full ASV to Dummy synchronization and healing workflow', async () => {
        const DummyModel = mongoose.model('DummyIdentity');
        
        // 1. Mache die dummy collection leer
        await DummyModel.deleteMany({});
        dummyDomain.invalidate();
        asv.invalidate();
        
        let dummyInitial = await dummyDomain.getIdentities();
        expect(dummyInitial.length).toBe(0);

        // 2. Synce die daten von asv nach dummy
        const task = new SyncTask('asv', 'dummy');
        let report = await task.execute({ forceRefresh: true });
        
        const asvData = await asv.getIdentities();
        let dummyAfterFirstSync = await dummyDomain.getIdentities();
        
        expect(dummyAfterFirstSync.length).toBe(asvData.length);
        expect(report.syncLog.added.length).toBe(asvData.length);
        expect(report.syncLog.changed ? report.syncLog.changed.length : 0).toBe(0);
        expect(report.syncLog.removed ? report.syncLog.removed.length : 0).toBe(0);

        // 3. Ändere in dummy ein paar identities, füge fiktive hinzu, lösche ein paar
        
        // Ändern
        if (dummyAfterFirstSync.length > 0) {
            const userToModify = dummyAfterFirstSync[0];
            await dummyDomain.changeIdentity({ ...userToModify, firstName: 'GEÄNDERTER_NAME' });
        }
        
        // Hinzufügen
        await dummyDomain.addIdentity(new Identity('fake_user_123', 'Fake', 'Ghost', { clazz: '99Z' }));
        
        // Löschen
        if (dummyAfterFirstSync.length > 1) {
            const userToDelete = dummyAfterFirstSync[1];
            await dummyDomain.removeIdentity(userToDelete);
        }

        dummyDomain.invalidate();
        const mutatedDummyState = await dummyDomain.getIdentities();
        expect(mutatedDummyState.length).toBe(asvData.length); // 1 hinzugefügt, 1 gelöscht -> gleiche Länge

        // 4. Führe dann nochmal den sync durch
        const task2 = new SyncTask('asv', 'dummy');
        let report2 = await task2.execute({ forceRefresh: true });

        // 5. Validiere, dass dummy am ende die gleiche identity menge hat, wie asv
        dummyDomain.invalidate(); 
        const dummyFinal = await dummyDomain.getIdentities();
        
        expect(dummyFinal.length).toBe(asvData.length);

        // Prüfe Logs: 1 wiederhergestellt (wurde gelöscht), 1 geändert (wurde falsch editiert), 1 gelöscht (der Fake-User)
        expect(report2.syncLog.added.length).toBe(1);
        expect(report2.syncLog.changed.length).toBe(1);
        expect(report2.syncLog.removed.length).toBe(1);
        
        // Verify dass die Attribute wirklich repariert wurden
        if (asvData.length > 0) {
             const restoredUser = dummyFinal.find(u => u.userId === asvData[0].userId);
             expect(restoredUser.firstName).toBe(asvData[0].firstName);
             expect(restoredUser.firstName).not.toBe('GEÄNDERTER_NAME');
             
             const fakeUserStillExists = dummyFinal.find(u => u.userId === 'fake_user_123');
             expect(fakeUserStillExists).toBeUndefined();
        }
    });
});
