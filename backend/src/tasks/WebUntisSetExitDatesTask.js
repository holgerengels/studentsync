const DiffTask = require('./DiffTask');
const { getDomain } = require('../domains/registry');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../utils/devMode');

class WebUntisSetExitDatesTask {
    async execute() {
        // Run standard Diff to find removed students
        const diffTask = new DiffTask('asv', 'webuntis');
        const report = await diffTask.execute({ forceRefresh: false });
        
        const devMode = isDevMode();
        
        let removed = report.diff.removed.map(i => i.userId);
        const { items: removedToProcess } = limitInDevMode(removed);
        
        if (removedToProcess.length === 0) {
            return { syncLog: {}, message: 'Nothing to do', dateCount: 0, devMode };
        }
        
        const asv = getDomain('asv');
        const webuntis = getDomain('webuntis');
        
        // Fetch exact exit dates natively from ASV (returns map of { userId: 'YYYY-MM-DD' })
        const exitDates = await asv.readExitDates(removedToProcess);
        
        const idsToProcess = Object.keys(exitDates).length;
        if (idsToProcess === 0) {
             return { syncLog: {}, message: 'No exact dates found for removed users.', dateCount: 0, devMode };
        }

        // Post exit dates sequentially to WebUntis
        const updatedUsers = await webuntis.writeExitDates(exitDates);
        
        const syncLog = {};
        if (updatedUsers.length > 0) syncLog.exitDatesSet = updatedUsers;

        return { 
            message: `Austrittsdatum für ${updatedUsers.length} von ${idsToProcess} Schülern gesetzt.`,
            syncLog: syncLog,
            dateCount: updatedUsers.length,
            devMode
        };
    }

    summarize(report) {
         if (!report) return '-';
         const suffix = devModeSuffix(report.devMode);
         
          if (report.dateCount > 0) {
               return `<div style="text-align: right;"><span style="color:var(--wa-color-success-600)">${report.message}</span>${suffix}</div>`;
          }
          return `<div style="text-align: right;"><span style="color:var(--wa-color-neutral-500)">Keine neuen Austritte (${report.message})</span>${suffix}</div>`;
    }
}

module.exports = WebUntisSetExitDatesTask;
