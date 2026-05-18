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
            return {
                success: true,
                devMode,
                details: {
                    removed: uidsToProcess.map(uid => ({ id: uid, old: { uid } })),
                    purgedCount: result.purged
                }
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

module.exports = NextcloudRemnantsPurgeTask;
