const DiffTask = require('./DiffTask');
const { getDomain } = require('../domains/registry');
const ManagableDomain = require('../domains/ManagableDomain');

class SyncTask extends DiffTask {
    constructor(sourceName, targetName) {
        super(sourceName, targetName);
        this.name = `${sourceName}-${targetName}-sync`;
    }

    async execute(parameters = {}) {
        // Run diff logic first
        const report = await super.execute(parameters);
        const diff = report.diff;

        const targetDomain = getDomain(this.targetName);
        if (!(targetDomain instanceof ManagableDomain)) {
            throw new Error(`Target domain ${this.targetName} is not managable. Sync aborted.`);
        }

        const config = require('../config');
        
        // Allow overriding dev mode through config, default to true unless NODE_ENV=production or explicitly disabled
        let isDevMode = process.env.NODE_ENV !== 'production';
        if (config && config.settings && config.settings.devMode === false) {
             isDevMode = false;
        }

        const additions = isDevMode ? diff.added.slice(0, 1) : diff.added;
        const changes = isDevMode ? diff.changed.slice(0, 1) : diff.changed;
        const removals = isDevMode ? diff.removed.slice(0, 1) : diff.removed;

        const addedArr = [];
        const changedArr = [];
        const removedArr = [];
        const errorsArr = [];

        for (const identity of additions) {
            try {
                await targetDomain.addIdentity(identity);
                addedArr.push(identity.userId);
            } catch (err) {
                if (err.name !== 'NotImplementedError') {
                    errorsArr.push(`Add error for ${identity.userId}: ${err.message}`);
                }
            }
        }

        for (const item of changes) {
            try {
                // Send the target identity layered with the source properties that need updating
                const updatedIdentity = { ...item.target, ...item.source };
                await targetDomain.changeIdentity(updatedIdentity);
                changedArr.push(item.source.userId || item.target.userId);
            } catch (err) {
                if (err.name !== 'NotImplementedError') {
                    errorsArr.push(`Change error for ${item.source.userId}: ${err.message}`);
                }
            }
        }

        for (const identity of removals) {
            try {
                 await targetDomain.removeIdentity(identity);
                 removedArr.push(identity.userId);
            } catch (err) {
                if (err.name !== 'NotImplementedError') {
                    errorsArr.push(`Remove error for ${identity.userId}: ${err.message}`);
                }
            }
        }
        const syncLog = {};
        if (addedArr.length > 0) syncLog.added = addedArr;
        if (changedArr.length > 0) syncLog.changed = changedArr;
        if (removedArr.length > 0) syncLog.removed = removedArr;
        if (errorsArr.length > 0) syncLog.errors = errorsArr;
        
        report.syncLog = syncLog;
        report.devMode = isDevMode;
        return report;
    }

    format(report) {
         if (!report || !report.syncLog) return super.format(report);
         
         const { syncLog, devMode } = report;
         const addCount = syncLog.added ? syncLog.added.length : 0;
         const changeCount = syncLog.changed ? syncLog.changed.length : 0;
         const rmCount = syncLog.removed ? syncLog.removed.length : 0;
         
         let msg = `Sync completed. Added: ${addCount}, Changed: ${changeCount}, Removed: ${rmCount}.`;
         if (devMode) {
             msg += ' <span style="font-size: smaller; opacity: 0.7;">[DEV MODE LIMIT]</span>';
         }
         if (syncLog.errors && syncLog.errors.length > 0) {
              msg += ` <br/><span style="color:#EF4444;">Errors: ${syncLog.errors.length}</span>`;
         }
         return `<div>${msg}</div>`;
    }
}
module.exports = SyncTask;
