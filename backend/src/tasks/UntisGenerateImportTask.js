const DiffTask = require('./DiffTask');

class UntisGenerateImportTask {
    async execute() {
        const diffTask = new DiffTask('asv', 'untis');
        // Get the list of identities missing in Untis
        const report = await diffTask.execute({ forceRefresh: false });

        let csvLines = [];

        if (report.diff && report.diff.added) {
            for (const addedIdent of report.diff.added) {
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
            filename: 'untis-import-added.csv',
            csvData: csvLines.join('\n') || ' Keine neuen Schueler gefunden\n'
        };
    }

    summarize(report) {
        if (!report || !report.csvData) return '-';
        const lines = report.csvData.split('\n').filter(l => l.trim().length > 0 && Array.from(l)[0] === '"');
        return `<div style="text-align: right;"><span style="color:var(--wa-color-success-600)">CSV Download mit ${lines.length} Datensätzen generiert</span></div>`;
    }
}

module.exports = UntisGenerateImportTask;
