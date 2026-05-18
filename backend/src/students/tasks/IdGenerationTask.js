const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../../utils/devMode');

class IdGenerationTask extends Task {
    constructor() {
        super('asv-generate-ids');
    }

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
             success: true,
             devMode,
             details: {
                 added: generated.map(u => ({ id: u.account, new: u })),
                 errors: errors.map((msg, i) => ({ id: `error-${i}`, message: msg })),
                 totalMissing: missing.length
             }
        };
    }

    format(report) {
        if (!report || !report.details) return '-';
        const suffix = devModeSuffix(report.devMode);

        const generatedCount = report.details.added ? report.details.added.length : 0;
        if (generatedCount > 0) {
            return `<span style="color: var(--wa-color-success-600); font-weight: bold;">+${generatedCount}/${report.details.totalMissing} IDs generiert${suffix}</span>`;
        }
        return `<span style="color:var(--wa-color-neutral-500)">Keine neuen IDs notwendig</span>`;
    }
}
module.exports = new IdGenerationTask();
