const SyncTask = require('../../tasks/SyncTask');

class FachnetzArbeitsheftSyncTask extends SyncTask {
    constructor() {
        super('fachnetz', 'arbeitsheft');
        this.name = 'fachnetz-arbeitsheft-sync';
    }

    async getSourceIdentities(domain) {
        const records = await super.getSourceIdentities(domain);
        
        // Map Fachnetz userIds to XWiki format
        return records.map(r => {
            const mapped = Object.assign(Object.create(Object.getPrototypeOf(r)), r);
            mapped.originalUserId = r.userId;
            mapped.userId = r.userId.toLowerCase().replace(/[@.]/g, '').replace(/[^a-z0-9-]/g, '');
            return mapped;
        });
    }
}

module.exports = FachnetzArbeitsheftSyncTask;
