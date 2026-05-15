const axios = require('axios');
const https = require('https');
const Identity = require('../../domains/Identity');
const config = require('../../config');
const Domain = require('../../domains/Domain');

class SchulkonsoleTeacher extends Domain {
    get supportedProperties() { return ['userId', 'firstName', 'lastName']; }
    get cacheTTL() { return 3600000; } // 1 hour

    constructor() {
        super('schulkonsole-teacher');
        const c = config.schulkonsole || {};
        this.apiURL = c.apiURL || process.env.SCHULKONSOLE_API;
        if (!this.apiURL) throw new Error('Schulkonsole apiURL missing');
        if (!this.apiURL.endsWith('/')) this.apiURL += '/';

        this.tokenURL = c.tokenURL || process.env.SCHULKONSOLE_TOKEN_URL;
        if (!this.tokenURL) throw new Error('Schulkonsole tokenURL missing');

        this.user = c.user || process.env.SCHULKONSOLE_USER;
        this.password = c.password || process.env.SCHULKONSOLE_PASSWORD;

        if (!this.user || !this.password) {
            throw new Error('Schulkonsole configuration incomplete. Missing user or password.');
        }

        this.axiosInstance = axios.create({
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });
    }

    async authenticate() {
        if (this.authHeader && Date.now() - this.authTime < 3600000) return;
        const tokenRes = await this.axiosInstance.post(this.tokenURL, {
            grant_type: 'password', username: this.user, password: this.password
        }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});
        this.authHeader = `${tokenRes.data.token_type} ${tokenRes.data.access_token}`;
        this.authTime = Date.now();
    }

    async readIdentities() {
        try {
            await this.authenticate();
            const res = await this.axiosInstance.get(`${this.apiURL}teachers`, {
                headers: { 'Authorization': this.authHeader }
            });

            return res.data.map(r =>
                new Identity(
                    r.userName,
                    r.givenName,
                    r.surname,
                    { id: r.id }
                )
            );
        } catch (e) {
            throw new Error('Schulkonsole Teacher read error: ' + e.message);
        }
    }
}

module.exports = new SchulkonsoleTeacher();
