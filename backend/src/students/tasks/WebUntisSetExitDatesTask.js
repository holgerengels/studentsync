const Task = require('../../tasks/Task');
const DiffTask = require('../../tasks/DiffTask');
const { getDomain } = require('../../domains/registry');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../../utils/devMode');

class WebUntisSetExitDatesTask extends Task {
    constructor() {
        super('web-untis-set-exit-dates');
    }

    async execute() {
        // Run standard Diff to find removed students
        const diffTask = new DiffTask('asv', 'webuntis');
        const report = await diffTask.execute({ forceRefresh: false });
        
        const devMode = isDevMode();
        
        let removed = report.details.removed.map(i => i.id);
        const { items: removedToProcess } = limitInDevMode(removed);
        
        console.log(`[ExitDates] ${removed.length} Schüler in WebUntis aber nicht in ASV. Verarbeite ${removedToProcess.length}.`);

        if (removedToProcess.length === 0) {
            return { success: true, devMode, details: {} };
        }
        
        const asv = getDomain('asv');
        const webuntis = getDomain('webuntis');
        
        // Fetch exact exit dates natively from ASV (returns map of { userId: 'YYYY-MM-DD' })
        const exitDates = await asv.readExitDates(removedToProcess);
        
        // Log which students have exit dates and which don't
        const withDate = Object.keys(exitDates);
        const withoutDate = removedToProcess.filter(u => !exitDates[u]);
        if (withDate.length > 0) {
            console.log(`[ExitDates] Austrittsdatum gefunden für: ${withDate.map(u => `${u} (${exitDates[u]})`).join(', ')}`);
        }
        if (withoutDate.length > 0) {
            console.log(`[ExitDates] Kein Austrittsdatum in ASV für: ${withoutDate.join(', ')} — diese werden übersprungen.`);
        }

        const idsToProcess = withDate.length;
        if (idsToProcess === 0) {
             return { success: true, devMode, details: { skippedWithoutDate: withoutDate } };
        }

        // Post exit dates sequentially to WebUntis
        const updatedUsers = await webuntis.writeExitDates(exitDates);
        
        return { 
            success: true,
            devMode,
            details: {
                changed: updatedUsers.map(u => ({ id: u, old: { exitDate: null }, new: { exitDate: exitDates[u] } })),
                skippedWithoutDate: withoutDate
            }
        };
    }
}

module.exports = WebUntisSetExitDatesTask;
