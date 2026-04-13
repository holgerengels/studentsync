const DiffTask = require('./DiffTask');
const { getDomain } = require('../domains/registry');

class WebUntisSetExitDatesTask {
    async execute() {
        // Run standard Diff to find removed students
        const diffTask = new DiffTask('asv', 'webuntis');
        const report = await diffTask.execute({ forceRefresh: false });
        
        const config = require('../config');
        let isDevMode = process.env.NODE_ENV !== 'production';
        if (config && config.settings && config.settings.devMode === false) {
             isDevMode = false;
        }
        
        let removed = report.diff.removed.map(i => i.userId);
        
        if (isDevMode && removed.length > 0) {
            removed = removed.slice(0, 1);
        }
        
        if (removed.length === 0) {
            return { syncLog: {}, message: 'Nothing to do', dateCount: 0, devMode: isDevMode };
        }
        
        const asv = getDomain('asv');
        const webuntis = getDomain('webuntis');
        
        // Fetch exact exit dates natively from ASV (returns map of { userId: 'YYYY-MM-DD' })
        const exitDates = await asv.readExitDates(removed);
        
        const idsToProcess = Object.keys(exitDates).length;
        if (idsToProcess === 0) {
             return { syncLog: {}, message: 'No exact dates found for removed users.', dateCount: 0, devMode: isDevMode };
        }

        // Post exit dates sequentially to WebUntis
        const updatedUsers = await webuntis.writeExitDates(exitDates);
        
        const syncLog = {};
        if (updatedUsers.length > 0) syncLog.exitDatesSet = updatedUsers;

        return { 
            message: `Austrittsdatum für ${updatedUsers.length} von ${idsToProcess} Schülern gesetzt.`,
            syncLog: syncLog,
            dateCount: updatedUsers.length,
            devMode: isDevMode
        };
    }

    summarize(report) {
         if (!report) return '-';
         let suffix = '';
         if (report.devMode) {
              suffix = ' <span style="font-size: smaller; opacity: 0.7;">[DEV MODE LIMIT]</span>';
         }
         
          if (report.dateCount > 0) {
               return `<div style="text-align: right;"><span style="color:var(--wa-color-success-600)">${report.message}</span>${suffix}</div>`;
          }
          return `<div style="text-align: right;"><span style="color:var(--wa-color-neutral-500)">Keine neuen Austritte (${report.message})</span>${suffix}</div>`;
    }
}

module.exports = WebUntisSetExitDatesTask;
