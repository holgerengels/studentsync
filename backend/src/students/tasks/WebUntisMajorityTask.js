const Task = require('./Task');
const { getDomain } = require('../domains/registry');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../utils/devMode');

class WebUntisMajorityTask extends Task {
    constructor() {
        super('web-untis-majority');
    }

    async execute(parameters = {}) {
        const devMode = isDevMode();
        const untis = getDomain('webuntis');

        console.log(`[WebUntisMajorityTask] Fetching identities from WebUntis...`);
        const identities = await untis.readIdentities();
        const pendingUpdates = [];

        // Reference target date for 18 years
        // We use the current date at sync time
        const today = new Date();
        const cutoffDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());

        for (const student of identities) {
            // Only care about students (skipping externally injected teachers if they were swept up, though WebUntis domain maps class/birthday)
            if (!student.birthday) continue;

            const birthDate = new Date(student.birthday);
            if (isNaN(birthDate.getTime())) continue;

            // Check if they are 18+
            if (birthDate <= cutoffDate) {
                if (student.majority !== true) {
                    pendingUpdates.push(student);
                }
            }
        }

        const { items: updatesToProcess } = limitInDevMode(pendingUpdates);

        const updatedLog = [];
        const errorLog = [];

        for (const student of updatesToProcess) {
            try {
                // Send targeted update that asserts majority = true.
                student.majority = true;
                await untis.changeIdentity(student);
                updatedLog.push(student.userId);
            } catch (e) {
                errorLog.push(`Update Error (${student.userId}): ${e.message}`);
            }
        }

        const syncLog = {};
        if (updatedLog.length > 0) syncLog.changed = updatedLog;
        if (errorLog.length > 0) syncLog.errors = errorLog;

        return {
             devMode,
             totalUpdatesDiscovered: pendingUpdates.length,
             syncLog: syncLog,
             diff: {
                 added: [],
                 changed: updatesToProcess.map(u => ({ source: u, target: u })),
                 removed: []
             }
        };
    }

    format(report) {
         if (!report) return '-';
         const changeCount = report.syncLog && report.syncLog.changed ? report.syncLog.changed.length : 0;
         const errorCount = report.syncLog && report.syncLog.errors ? report.syncLog.errors.length : 0;

         let msg = `Majority Sync. <span style="color: var(--wa-color-warning-600)">Updated: ${changeCount}/${report.totalUpdatesDiscovered}</span> students turning 18.`;
         msg += devModeSuffix(report.devMode);
         if (errorCount > 0) {
              msg += ` <br/><span style="color:#EF4444;">Errors: ${errorCount}</span>`;
         }
         return `<div>${msg}</div>`;
    }
}

module.exports = WebUntisMajorityTask;
