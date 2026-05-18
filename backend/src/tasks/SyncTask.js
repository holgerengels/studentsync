const DiffTask = require('./DiffTask');
const { getDomain } = require('../domains/registry');
const ManagableDomain = require('../domains/ManagableDomain');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../utils/devMode');

class SyncTask extends DiffTask {
    constructor(sourceName, targetName) {
        super(sourceName, targetName);
        this.name = `${sourceName}-${targetName}-sync`;
    }

    async execute(parameters = {}) {
        // Run diff logic first
        const report = await super.execute(parameters);
        const details = report.details;

        const targetDomain = getDomain(this.targetName);
        if (!(targetDomain instanceof ManagableDomain)) {
            throw new Error(`Target domain ${this.targetName} is not managable. Sync aborted.`);
        }

        const devMode = isDevMode();

        const additions = devMode ? details.added.slice(0, 1) : details.added;
        const changes = devMode ? details.changed.slice(0, 1) : details.changed;
        const removals = devMode ? details.removed.slice(0, 1) : details.removed;

        const addedArr = [];
        const changedArr = [];
        const removedArr = [];
        const errorsArr = [];

        if (typeof targetDomain.lock === 'function') {
            targetDomain.lock();
        }

        try {
            for (const item of additions) {
                try {
                    await targetDomain.addIdentity(item.new);
                    addedArr.push(item);
                } catch (err) {
                    if (err.name !== 'NotImplementedError') {
                        errorsArr.push({ id: item.id, message: `Add error: ${err.message}` });
                    }
                }
            }

            for (const item of changes) {
                try {
                    // Send the target identity layered with the source properties that need updating
                    const updatedIdentity = { ...item.old, ...item.new };
                    await targetDomain.changeIdentity(updatedIdentity);
                    changedArr.push(item);
                } catch (err) {
                    if (err.name !== 'NotImplementedError') {
                        errorsArr.push({ id: item.id, message: `Change error: ${err.message}` });
                    }
                }
            }

            for (const item of removals) {
                try {
                     await targetDomain.removeIdentity(item.old);
                     removedArr.push(item);
                } catch (err) {
                    if (err.name !== 'NotImplementedError') {
                        errorsArr.push({ id: item.id, message: `Remove error: ${err.message}` });
                    }
                }
            }
        } finally {
            if (typeof targetDomain.unlock === 'function') {
                targetDomain.unlock();
            }
        }
        report.details.added = addedArr;
        report.details.changed = changedArr;
        report.details.removed = removedArr;
        report.details.errors = errorsArr;
        
        report.devMode = devMode;
        return report;
    }
}
module.exports = SyncTask;
