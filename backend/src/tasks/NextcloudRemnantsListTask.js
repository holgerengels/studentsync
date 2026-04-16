const Task = require('./Task');
const nextcloud = require('../domains/Nextcloud');

class NextcloudRemnantsListTask extends Task {
    constructor() {
        super('nextcloud-remnants-list');
    }

    async execute(parameters = {}) {
        try {
            const rawRemnants = await nextcloud.getRemnants();
            
            const remnants = [];
            if (rawRemnants && rawRemnants.length > 0) {
                for (const rem of rawRemnants) {
                    const uid = rem.ocName || rem.account || rem.uid || (typeof rem === 'string' ? rem : 'Unbekannt');
                    const name = rem.displayName || rem.displayname || rem.name || '';
                    remnants.push({ uid, name, selected: false });
                }
            }
            
            return { success: true, count: remnants.length, remnants };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    format(report) {
        if (!report) return '-';
        if (!report.success) return `<div style="color:var(--wa-color-danger-600)">Fehler beim Abrufen der Remnants: ${report.error}</div>`;
        return `<div><strong>Nextcloud Remnants:</strong> Es wurden ${report.count} Remnant(s) gefunden.</div>`;
    }
}

module.exports = NextcloudRemnantsListTask;
