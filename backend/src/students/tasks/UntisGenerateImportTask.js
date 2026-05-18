const Task = require('../../tasks/Task');
const DiffTask = require('../../tasks/DiffTask');

class UntisGenerateImportTask extends Task {
    constructor() {
        super('untis-generate-import');
    }
    async execute() {
        const diffTask = new DiffTask('asv', 'untis');
        // Get the list of identities missing in Untis
        const report = await diffTask.execute({ forceRefresh: false });

        let csvLines = [];

        if (report.details && report.details.added) {
            for (const item of report.details.added) {
                const addedIdent = item.new;
                const row = new Array(15).fill('');
                row[0] = `"${addedIdent.userId || ''}"`;
                row[1] = `"${addedIdent.lastName || ''}"`;
                let gen = addedIdent.gender || '';
                if (gen) gen = gen.toUpperCase();

                row[6] = `"${gen}"`;
                row[7] = `"${addedIdent.firstName || ''}"`;
                row[9] = `"${addedIdent.clazz || ''}"`;
                row[10] = gen === 'M' ? "2" : gen === 'W' ? "1" : "0";

                let bday = '';
                if (addedIdent.birthday) {
                    bday = addedIdent.birthday.replace(/-/g, '');
                }

                row[12] = bday || '""';
                row[14] = `"${addedIdent.userId || ''}"`;

                csvLines.push(row.join(','));
            }
        }

        return {
            success: true,
            filename: 'untis-import-added.csv',
            csvData: csvLines.join('\n') || ' Keine neuen Schueler gefunden\n',
            details: {
                generatedCsvLines: csvLines.length
            }
        };
    }

    format(report) {
        if (!report) return '-';
        if (report.success === false) return `<div style="color:var(--wa-color-danger-600)">Fehler: ${report.error}</div>`;
        const count = report.details && report.details.generatedCsvLines ? report.details.generatedCsvLines : 0;
        return `<div style="color:var(--wa-color-success-600)">CSV Download mit ${count} Datensätzen generiert</div>`;
    }
}

module.exports = UntisGenerateImportTask;
