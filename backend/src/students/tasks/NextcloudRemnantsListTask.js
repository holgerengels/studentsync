const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');

class NextcloudRemnantsListTask extends Task {
    constructor() {
        super('nextcloud-remnants-list');
    }

    async execute(parameters = {}) {
        try {
            const nextcloud = getDomain('nextcloud');
            const rawRemnants = await nextcloud.getRemnants();
            
            const remnants = [];
            if (rawRemnants && rawRemnants.length > 0) {
                for (const rem of rawRemnants) {
                    const uid = rem.ocName || rem.account || rem.uid || (typeof rem === 'string' ? rem : 'Unbekannt');
                    const name = rem.displayName || rem.displayname || rem.name || '';
                    remnants.push({ uid, name, selected: false });
                }
            }
            
            return { 
                success: true, 
                details: {
                    remnantsFound: remnants.length,
                    remnants: remnants.map(r => ({ id: r.uid, data: r }))
                }
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    format(report) {
        if (!report) return '-';
        if (report.success === false) return `<div style="color:var(--wa-color-danger-600)">Fehler: ${report.error}</div>`;
        const count = report.details && report.details.remnantsFound ? report.details.remnantsFound : 0;
        return `<div><strong>Nextcloud Remnants:</strong> Es wurden ${count} Remnant(s) gefunden.</div>`;
    }
}

module.exports = NextcloudRemnantsListTask;
