const { getDomain } = require('../domains/registry');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../utils/devMode');

class IdGenerationTask {
    async execute() {
        const devMode = isDevMode();
        const asv = getDomain('asv');

        // Step 1: Read which students need a new ID (pure read)
        const missing = await asv.readStudentsWithoutIds();

        // Step 2: Limit writes in devMode
        const { items: toProcess } = limitInDevMode(missing);

        // Step 3: Generate and write each ID individually
        const generated = [];
        const errors = [];
        for (const student of toProcess) {
            try {
                const result = await asv.writeGeneratedId(student);
                generated.push(result);
            } catch (e) {
                errors.push(`${student.lastName}: ${e.message}`);
            }
        }

        if (generated.length > 0) {
            asv.invalidate();
        }

        return {
             syncLog: {
                 generatedIds: generated.map(u => u.account),
                 errors
             },
             generated,
             totalMissing: missing.length,
             devMode
        };
    }

    summarize(report) {
        if (!report) return '-';
        if (report.error) return `<span style="color: #EF4444;">Fehler: ${report.error}</span>`;

        const suffix = devModeSuffix(report.devMode);

        if (report.generated && report.generated.length > 0) {
            return `<span style="color: #10B981; font-weight: bold;">+${report.generated.length}/${report.totalMissing} IDs generiert${suffix}</span>`;
        }
        return `<span style="color:var(--wa-color-neutral-500)">Keine neuen IDs notwendig</span>`;
    }
}
module.exports = new IdGenerationTask();
