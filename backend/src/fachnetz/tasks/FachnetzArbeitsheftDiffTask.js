const DiffTask = require('../../tasks/DiffTask');

class FachnetzArbeitsheftDiffTask extends DiffTask {
    constructor() {
        super('fachnetz', 'arbeitsheft');
        this.name = 'fachnetz-arbeitsheft-diff';
    }

    async getSourceIdentities(domain) {
        const records = await super.getSourceIdentities(domain);
        
        // Map Fachnetz userIds to XWiki format
        // XWiki strips @ and . and converts to lowercase
        return records.map(r => {
            // Create a clone to avoid mutating the cached Identity objects
            const mapped = Object.assign(Object.create(Object.getPrototypeOf(r)), r);
            mapped.originalUserId = r.userId; // Preserve original if needed
            mapped.userId = r.userId.toLowerCase().replace(/[@.]/g, '').replace(/[^a-z0-9-]/g, '');
            return mapped;
        });
    }
}

module.exports = FachnetzArbeitsheftDiffTask;
