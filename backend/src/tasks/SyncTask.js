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

        const syncLog = {
            added: [],
            changed: [],
            removed: [],
            errors: []
        };

        for (const identity of additions) {
            try {
                await targetDomain.addIdentity(identity);
                syncLog.added.push(identity.userId);
            } catch (err) {
                syncLog.errors.push(`Add error for ${identity.userId}: ${err.message}`);
            }
        }

        for (const item of changes) {
            try {
                // Send the target identity layered with the source properties that need updating
                const updatedIdentity = { ...item.target, ...item.source };
                await targetDomain.changeIdentity(updatedIdentity);
                syncLog.changed.push(item.source.userId || item.target.userId);
            } catch (err) {
                syncLog.errors.push(`Change error for ${item.source.userId}: ${err.message}`);
            }
        }

        for (const identity of removals) {
            try {
                 await targetDomain.removeIdentity(identity);
                 syncLog.removed.push(identity.userId);
            } catch (err) {
                syncLog.errors.push(`Remove error for ${identity.userId}: ${err.message}`);
            }
        }
        
        report.syncLog = syncLog;
        report.devMode = isDevMode;
        return report;
    }

    format(report) {
         if (!report || !report.syncLog) return super.format(report);
         
         const { syncLog, devMode } = report;
         let msg = `Sync completed. Added: ${syncLog.added.length}, Changed: ${syncLog.changed.length}, Removed: ${syncLog.removed.length}.`;
         if (devMode) {
             msg += ' <span style="font-size: smaller; opacity: 0.7;">[DEV MODE LIMIT]</span>';
         }
         if (syncLog.errors.length > 0) {
              msg += ` <br/><span style="color:#EF4444;">Errors: ${syncLog.errors.length}</span>`;
         }
         return `<div>${msg}</div>`;
    }
}
module.exports = SyncTask;
