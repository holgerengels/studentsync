const { getDomain } = require('../domains/registry');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../utils/devMode');

class UntisTeacherExternalIdsTask {
    constructor() {
        this.name = 'untis-teacher-external-ids';
    }

    async execute() {
        const devMode = isDevMode();
        const untis = getDomain('untis');

        // Step 1: Read which teachers need an update (pure read, no writes)
        const { pending, missingDomain } = await untis.readTeachersWithMissingExternalIds();

        // Step 2: Limit writes in devMode
        const { items: toProcess } = limitInDevMode(pending);

        // Step 3: Write each external ID individually
        const updatedIds = [];
        const errors = [];
        for (const { name, foreignKey } of toProcess) {
            try {
                await untis.writeTeacherExternalId(name, foreignKey);
                updatedIds.push(name);
            } catch (e) {
                errors.push(`${name}: ${e.message}`);
            }
        }

        return {
            changedCount: updatedIds.length,
            totalPending: pending.length,
            missingCount: missingDomain.length,
            syncLog: {
                changed: updatedIds,
                errors,
                missingDomain
            },
            devMode
        };
    }

    summarize(report) {
         if (report.syncLog && report.syncLog.errors && report.syncLog.errors.length) {
             return `<span style="color:var(--wa-color-danger-500)">Fehler: ${report.syncLog.errors[0]}</span>`;
         }

         let html = '';
         const suffix = devModeSuffix(report.devMode);

         if (report.changedCount > 0) {
             html += `<div style="color: #10B981; font-weight: bold;">${report.changedCount}/${report.totalPending} Lehrer-IDs aktualisiert${suffix}</div>`;
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
