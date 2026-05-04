const untis = require('../domains/Untis');
const config = require('../config');

class UntisTeacherExternalIdsTask {
    constructor() {
        this.name = 'untis-teacher-external-ids';
    }

    async execute() {
        let isDevMode = process.env.NODE_ENV !== 'production';
        if (config && config.settings && config.settings.devMode !== undefined) {
             isDevMode = config.settings.devMode;
        }

        const result = await untis.teacherExternalIds(isDevMode);
        
        return {
            changedCount: result.updatedIds.length,
            missingCount: result.missingDomain.length,
            syncLog: {
                added: [],
                changed: result.updatedIds, 
                removed: [],
                errors: [],
                missingDomain: result.missingDomain
            },
            devMode: isDevMode
        };
    }

    summarize(report) {
         if (report.syncLog && report.syncLog.errors && report.syncLog.errors.length) {
             return `<span style="color:var(--wa-color-danger-500)">Fehler: ${report.syncLog.errors[0]}</span>`;
         }

         let html = '';
         
         let suffix = '';
         if (report.devMode) {
              suffix = ' <span style="font-size: smaller; opacity: 0.7;">[DEV MODE LIMIT]</span>';
         }

         if (report.changedCount > 0) {
             html += `<div style="color: #10B981; font-weight: bold;">${report.changedCount} Lehrer-IDs aktualisiert${suffix}</div>`;
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
