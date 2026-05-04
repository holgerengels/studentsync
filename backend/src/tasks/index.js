const DiffTask = require('./DiffTask');
const SyncTask = require('./SyncTask');
const config = require('../config');

// All tasks registered as instances with kebab-case names
const registry = {
    'asv-generate-ids': require('./IdGenerationTask'),
    'dummy': new (require('./DummyTask'))(),
    'dummy-random-modifications': new (require('./DummyRandomModificationsTask'))(),
    'untis-generate-import': new (require('./UntisGenerateImportTask'))(),
    'untis-teacher-external-ids': require('./UntisTeacherExternalIdsTask'),
    'web-untis-set-exit-dates': new (require('./WebUntisSetExitDatesTask'))(),
    'web-untis-guardian-sync': new (require('./WebUntisGuardianSyncTask'))(),
    'web-untis-majority': new (require('./WebUntisMajorityTask'))(),
    'nextcloud-remnants-list': new (require('./NextcloudRemnantsListTask'))(),
    'nextcloud-remnants-purge': new (require('./NextcloudRemnantsPurgeTask'))()
};

// Dynamically register SyncTask and DiffTask instances from config
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
