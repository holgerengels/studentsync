const WebUntisInstance = require('./WebUntis');
const WebUntisClass = Object.getPrototypeOf(WebUntisInstance).constructor;

class WebUntisRest extends WebUntisClass {
    constructor(configOverrides = {}) {
        super(configOverrides);
        this.domainName = 'webuntis-rest';
    }

    async changeIdentity(identity) {
        if (!this.internalIds) await this.getIdentities();

        const internalId = this.internalIds[identity.userId];
        if (!internalId) throw new Error(`Cannot change WebUntis identity via REST: No internalId found for account ${identity.userId}`);

        console.log(`[WebUntisRest] Updating identity ${identity.userId} via REST API v3...`);

        // Construct the ExternStudentDto mapping
        const dto = {
            id: parseInt(internalId, 10),
            externKey: identity.userId,
            shortName: identity.userId,       // Usually WebUntis shortName corresponds to the internal ID or account
            lastName: identity.lastName || identity.userId,
            forename: identity.firstName || '',
            adult: identity.majority === true,
            active: true
        };

        if (identity.birthday) {
            dto.birthDate = identity.birthday; // YYYY-MM-DD
        }

        if (identity.gender === 'm') dto.gender = 'male';
        if (identity.gender === 'f') dto.gender = 'female';
        if (identity.gender === 'd') dto.gender = 'inter';

        const payload = {
            students: [dto]
        };

        try {
            // First, ensure session is warmed up via index.do (fetches CSRF)
            const indexRes = await this.authClient.get(this.url + 'index.do', { validateStatus: false });
            
            let htmlStr = typeof indexRes.data === 'string' ? indexRes.data : JSON.stringify(indexRes.data);
            let csrfMatch = htmlStr.match(/"csrfToken"\s*:\s*"([^"]+)"/) || htmlStr.match(/csrfToken":"([^"]+)"/);
            let csrfToken = csrfMatch ? csrfMatch[1] : '';

            console.log(`[WebUntisRest] CSRF token available: ${csrfToken ? 'Yes' : 'No'}`);

            const putUrl = this.url + 'api/rest/extern/v3/students?school=VU';
            console.log(`[WebUntisRest] Request PUT to ${putUrl}`);
            console.log(`[WebUntisRest] Request Body:`, JSON.stringify(payload, null, 2));

            const saveRes = await this.authClient.put(putUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrfToken
                },
                validateStatus: false
            });

            console.log(`[WebUntisRest] PUT result: HTTP ${saveRes.status}`);
            
            this.lastSaveStatus = saveRes.status;
            
            if (saveRes.status >= 400) {
                 console.error(`[WebUntisRest] Error response Payload:`, JSON.stringify(saveRes.data));
                 throw new Error(`WebUntisRest mutation failed. Status: ${saveRes.status}`);
            }

            this.invalidate();

        } catch (e) {
            console.error(`WebUntisRest changeIdentity error for ${identity.userId}:`, e.message);
            throw e;
        }
    }
}

module.exports = WebUntisRest;
