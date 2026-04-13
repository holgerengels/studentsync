const Task = require('./Task');
const untis = require('../domains/WebUntis');
const config = require('../config');

class WebUntisMajorityTask extends Task {
    constructor() {
        super('web-untis-majority');
    }

    async execute(parameters = {}) {
        let isDevMode = process.env.NODE_ENV !== 'production';
        if (config && config.settings && config.settings.devMode === false) {
             isDevMode = false;
        }

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

        const updatesToProcess = isDevMode ? pendingUpdates.slice(0, 1) : pendingUpdates;

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
             devMode: isDevMode,
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
         
         if (report.devMode) {
             msg += ' <span style="font-size: smaller; opacity: 0.7;">[DEV MODE LIMIT]</span>';
         }
         if (errorCount > 0) {
              msg += ` <br/><span style="color:#EF4444;">Errors: ${errorCount}</span>`;
         }
         return `<div>${msg}</div>`;
    }
}

module.exports = WebUntisMajorityTask;
