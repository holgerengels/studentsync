const axios = require('axios');
const Identity = require('../../domains/Identity');
const Domain = require('../../domains/Domain');
const config = require('../../config');

class MailCowTeacher extends Domain {
    get supportedProperties() { return ['userId', 'firstName', 'lastName', 'email', 'login']; }
    get cacheTTL() { return 3600000; } // 1 hour

    constructor() {
        super('mailcow-teacher');
        this.mailcowConfig = config.mailcow || {};
        
        if (!this.mailcowConfig.apiKey || !this.mailcowConfig.apiURL) {
            console.warn('[MailCowTeacher] Missing apiKey or apiURL configuration in settings.json');
        }

        this.client = axios.create({
            headers: {
                'X-API-Key': this.mailcowConfig.apiKey,
                'Accept': 'application/json'
            }
        });
    }

    async readIdentities() {
        if (!this.mailcowConfig.apiKey || !this.mailcowConfig.apiURL) {
            throw new Error('MailCow configuration is incomplete. Missing apiKey or apiURL.');
        }

        try {
            let apiURL = this.mailcowConfig.apiURL;
            if (!apiURL.endsWith('/')) apiURL += '/';

            // Fetch mailboxes
            const response = await this.client.get(`${apiURL}get/mailbox/all`);
            const data = response.data;

            // The API returns an array of mailbox objects
            if (!Array.isArray(data)) {
                throw new Error('Invalid response from MailCow API (expected data array)');
            }

            const identities = [];

            for (const item of data) {
                const tags = item.tags || [];
                // Only include accounts with the 'ldap' tag
                if (tags.includes('ldap')) {
                    const localPart = item.local_part || '';
                    const username = item.username || '';
                    const fullName = (item.name || '').trim();
                    const customAttrs = item.custom_attributes || {};
                    const kuerzel = customAttrs.kuerzel || '';

                    // Use kuerzel as userId for ASV matching; skip mailboxes without one
                    if (!kuerzel) continue;

                    let firstName = fullName;
                    let lastName = fullName;

                    const lastSpaceIndex = fullName.lastIndexOf(' ');
                    if (lastSpaceIndex !== -1) {
                        firstName = fullName.substring(0, lastSpaceIndex).trim();
                        lastName = fullName.substring(lastSpaceIndex + 1).trim();
                    }

                    identities.push(new Identity(
                        kuerzel,
                        firstName,
                        lastName,
                        { email: username, login: localPart }
                    ));
                }
            }

            // Sort by userId (kuerzel)
            identities.sort((a, b) => a.userId.localeCompare(b.userId));

            return identities;

        } catch (e) {
            console.error('MailCow Teacher query failed:', e.message);
            throw new Error('MailCow Teacher query failed: ' + e.message);
        }
    }
}

module.exports = new MailCowTeacher();
