const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../../utils/devMode');

class UntisTeacherExternalIdsTask extends Task {
    constructor() {
        super('untis-teacher-external-ids');
    }

    async execute() {
        const devMode = isDevMode();
        const untisTeacher = getDomain('untis-teacher');

        // Step 1: Read which teachers need an update (pure read, no writes)
        const { pending, missingDomain } = await untisTeacher.readTeachersWithMissingExternalIds();

        // Step 2: Limit writes in devMode
        const { items: toProcess } = limitInDevMode(pending);

        // Step 3: Write each external ID individually
        const updatedIds = [];
        const errors = [];
        for (const { name, foreignKey } of toProcess) {
            try {
                await untisTeacher.writeTeacherExternalId(name, foreignKey);
                updatedIds.push({ id: name, old: { externalId: null }, new: { externalId: foreignKey } });
            } catch (e) {
                errors.push({ id: name, message: e.message });
            }
        }

        return {
            success: true,
            devMode,
            details: {
                changed: updatedIds,
                errors,
                missingDomain,
                totalPending: pending.length
            }
        };
    }

    format(report) {
         if (!report || !report.details) return '-';

         let html = '';
         const suffix = devModeSuffix(report.devMode);
         
         const changedCount = report.details.changed ? report.details.changed.length : 0;
         const totalPending = report.details.totalPending || 0;
         const missingCount = report.details.missingDomain ? report.details.missingDomain.length : 0;

         if (changedCount > 0) {
             html += `<div style="color: var(--wa-color-success-600); font-weight: bold;">${changedCount}/${totalPending} Lehrer-IDs aktualisiert${suffix}</div>`;
         } else {
             html += `<div style="color:var(--wa-color-neutral-500)">Keine Lehrer-IDs zu aktualisieren</div>`;
         }

         if (missingCount > 0) {
             html += `<div style="color:var(--wa-color-warning-600); font-size: 0.9em; margin-top: 0.25rem;">${missingCount} Lehrer ohne gültige System-Email</div>`;
         }

         return html;
    }
}

module.exports = new UntisTeacherExternalIdsTask();
