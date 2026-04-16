const Task = require('./Task');
const nextcloud = require('../domains/Nextcloud');

class NextcloudRemnantsPurgeTask extends Task {
    constructor() {
        super('nextcloud-remnants-purge');
    }

    async execute(parameters = {}) {
        try {
            let uids = parameters.uids;
            if (!uids || !Array.isArray(uids) || uids.length === 0) {
                throw new Error("Für die Bereinigung muss eine explizite Liste von UIDs (uids) übergeben werden.");
            }

            const config = require('../config');
            const isDevMode = !(config && config.settings && config.settings.devMode === false);
            
            if (isDevMode && uids.length > 1) {
                uids = uids.slice(0, 1);
            }

            const result = await nextcloud.purgeRemnants(uids);
            return { success: true, purged: result.purged, details: result.details, devMode: isDevMode };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    format(report) {
        if (!report) return '-';
        if (!report.success) return `<div class="text-danger">Fehler beim Bereinigen der Remnants: ${report.error}</div>`;
        return `<div><strong>Nextcloud Remnants Bereinigung:</strong> Es wurden ${report.purged} Remnant(s) erfolgreich gelöscht.</div>`;
    }
}

module.exports = NextcloudRemnantsPurgeTask;
