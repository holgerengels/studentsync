const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../../utils/devMode');

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

            const devMode = isDevMode();
            const nextcloud = getDomain('nextcloud');
            const { items: uidsToProcess } = limitInDevMode(uids);

            const result = await nextcloud.purgeRemnants(uidsToProcess);
            return { success: true, purged: result.purged, details: result.details, devMode };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    format(report) {
        if (!report) return '-';
        if (!report.success) return `<div class="text-danger">Fehler beim Bereinigen der Remnants: ${report.error}</div>`;
        let msg = `<strong>Nextcloud Remnants Bereinigung:</strong> Es wurden ${report.purged} Remnant(s) erfolgreich gelöscht.`;
        msg += devModeSuffix(report.devMode);
        return `<div>${msg}</div>`;
    }
}

module.exports = NextcloudRemnantsPurgeTask;
