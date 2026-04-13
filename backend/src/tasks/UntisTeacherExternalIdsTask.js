const untis = require('../domains/Untis');

class UntisTeacherExternalIdsTask {
    constructor() {
        this.name = 'untis-teacher-external-ids';
    }

    async execute() {
        const result = await untis.teacherExternalIds();
        
        return {
            changedCount: result.updatedIds.length,
            missingCount: result.missingDomain.length,
            syncLog: {
                added: [],
                changed: result.updatedIds, 
                removed: [],
                errors: [],
                missingDomain: result.missingDomain
            }
        };
    }

    summarize(report) {
         if (report.syncLog && report.syncLog.errors && report.syncLog.errors.length) {
             return `<span style="color:var(--wa-color-danger-500)">Fehler: ${report.syncLog.errors[0]}</span>`;
         }

         let html = '';
         if (report.changedCount > 0) {
             html += `<div style="color: #10B981; font-weight: bold;">${report.changedCount} Lehrer-IDs aktualisiert</div>`;
         } else {
             html += `<div style="color:var(--wa-color-neutral-500)">Keine Lehrer-IDs zu aktualisieren</div>`;
         }

         if (report.missingCount > 0) {
             html += `<div style="color:var(--wa-color-warning-600); font-size: 0.9em; margin-top: 0.25rem;">${report.missingCount} Lehrer ohne gültige System-Email</div>`;
         }

         return html;
    }
}

module.exports = new UntisTeacherExternalIdsTask();
