const DiffTask = require('./DiffTask');
const SyncTask = require('./SyncTask');
const config = require('../config');

const registry = {
    'ID_GENERATION': require('./IdGenerationTask'),
    'asv-generate-ids': require('./IdGenerationTask'),
    'DIFF': new DiffTask(),
    'SYNC': new SyncTask(),
    'DUMMY': new (require('./DummyTask'))(),
    'dummy': new (require('./DummyTask'))(),
    'dummy-random-modifications': new (require('./DummyRandomModificationsTask'))(),
    'untis-generate-import': new (require('./UntisGenerateImportTask'))(),
    'web-untis-set-exit-dates': new (require('./WebUntisSetExitDatesTask'))(),
    'untis-teacher-external-ids': require('./UntisTeacherExternalIdsTask'),
    'web-untis-guardian-sync': new (require('./WebUntisGuardianSyncTask'))(),
    'web-untis-majority': new (require('./WebUntisMajorityTask'))()
};

if (config && config.tasks) {
    for (const t of config.tasks) {
        if (t.class === 'SyncTask' && t.source && t.target) {
            registry[t.name] = new SyncTask(t.source.toLowerCase(), t.target.toLowerCase());
            registry[t.name].name = t.name;
        }
        if (t.class === 'DiffTask' && t.source && t.target) {
            registry[t.name] = new DiffTask(t.source.toLowerCase(), t.target.toLowerCase());
            registry[t.name].name = t.name;
        }
    }
}

module.exports = registry;
