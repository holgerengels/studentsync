const Task = require('./Task');
const asv = require('../domains/ASV');
const untis = require('../domains/WebUntis');
const config = require('../config');

class WebUntisGuardianSyncTask extends Task {
    constructor() {
        super('web-untis-guardian-sync');
    }

    async execute(parameters = {}) {
        let isDevMode = process.env.NODE_ENV !== 'production';
        if (config && config.settings && config.settings.devMode === false) {
             isDevMode = false;
        }

        const [asvGuardians, untisGuardians] = await Promise.all([
            asv.readGuardians(),
            untis.readGuardians()
        ]);

        const untisMap = {};
        for (const ug of untisGuardians) {
            if (ug.email) {
                untisMap[ug.email.toLowerCase()] = ug;
            }
        }

        const additions = [];
        const updates = [];

        for (const guardian of asvGuardians) {
            const email = guardian.email;
            if (!email) continue;
            
            const studentAccounts = guardian.students.map(s => s.account);
            
            const untisG = untisMap[email];
            if (!untisG) {
                additions.push({ guardian, studentAccounts });
            } else {
                const untisStudentAccounts = untisG.students.map(s => s.account);
                let needsUpdate = false;
                const missingStudents = studentAccounts.filter(acc => !untisStudentAccounts.includes(acc));
                
                if (guardian.lastName !== untisG.lastName || guardian.firstName !== untisG.firstName) {
                    needsUpdate = true;
                }
                if (missingStudents.length > 0) {
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    // Inject the ID from WebUntis so we update the correct mapped record
                    guardian.id = untisG.id;
                    updates.push({ guardian, studentAccounts });
                }
            }
        }

        const addsToProcess = isDevMode ? additions.slice(0, 1) : additions;
        const updatesToProcess = isDevMode ? updates.slice(0, 1) : updates;

        const addedLog = [];
        const updatedLog = [];
        const errorLog = [];

        for (const req of addsToProcess) {
            try {
                await untis.changeGuardian(req.guardian, req.studentAccounts);
                addedLog.push(req.guardian.email);
            } catch (e) {
                errorLog.push(`Add Error (${req.guardian.email}): ${e.message}`);
            }
        }

        for (const req of updatesToProcess) {
            try {
                await untis.changeGuardian(req.guardian, req.studentAccounts);
                updatedLog.push(req.guardian.email);
            } catch (e) {
                errorLog.push(`Update Error (${req.guardian.email}): ${e.message}`);
            }
        }

        const syncLog = {};
        if (addedLog.length > 0) syncLog.added = addedLog;
        if (updatedLog.length > 0) syncLog.changed = updatedLog;
        if (errorLog.length > 0) syncLog.errors = errorLog;

        return {
             devMode: isDevMode,
             totalAdditionsDiscovered: additions.length,
             totalUpdatesDiscovered: updates.length,
             syncLog: syncLog,
             diff: { // Keep a stub here in case frontend task components assume 'diff' exists for expansion logs
                 added: addsToProcess.map(a => ({ userId: a.guardian.email, model: a.guardian })),
                 changed: updatesToProcess.map(u => ({ source: { userId: u.guardian.email }, target: { userId: u.guardian.email } })),
                 removed: []
             }
        };
    }

    format(report) {
         if (!report) return '-';
         const addCount = report.syncLog && report.syncLog.added ? report.syncLog.added.length : 0;
         const changeCount = report.syncLog && report.syncLog.changed ? report.syncLog.changed.length : 0;
         const errorCount = report.syncLog && report.syncLog.errors ? report.syncLog.errors.length : 0;

         let msg = `Guardian Sync. <span style="color: var(--wa-color-success-600)">Added: ${addCount}/${report.totalAdditionsDiscovered}</span>, <span style="color: var(--wa-color-warning-600)">Updated: ${changeCount}/${report.totalUpdatesDiscovered}</span>.`;
         
         if (report.devMode) {
             msg += ' <span style="font-size: smaller; opacity: 0.7;">[DEV MODE LIMIT]</span>';
         }
         if (errorCount > 0) {
              msg += ` <br/><span style="color:#EF4444;">Errors: ${errorCount}</span>`;
         }
         return `<div>${msg}</div>`;
    }
}

module.exports = WebUntisGuardianSyncTask;
