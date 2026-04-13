const asv = require('../domains/ASV');

class IdGenerationTask {
    async execute() {
        const generated = await asv.generateIds();
        return {
             syncLog: { generatedIds: generated.map(u => u.account) },
             generated: generated
        };
    }

    summarize(report) {
        if (!report) return '-';
        if (report.error) return `<span style="color: #EF4444;">Fehler: ${report.error}</span>`;
        if (report.generated && report.generated.length > 0) return `<span style="color: #10B981; font-weight: bold;">+${report.generated.length} IDs generiert</span>`;
        return `<span style="color:var(--wa-color-neutral-500)">Keine neuen IDs notwendig</span>`;
    }
}
module.exports = new IdGenerationTask();
