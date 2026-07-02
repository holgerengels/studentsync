const ManagableDomain = require('./ManagableDomain');
const Identity = require('./Identity');
const crypto = require('crypto');
const config = require('../config');
const mongoose = require('mongoose');

const matrixSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    firstName: String,
    lastName: String,
    category: { type: String, required: true }, // 'students' or 'teachers'
    login: String
}, { strict: false });

matrixSchema.index({ userId: 1, category: 1 }, { unique: true });

const MatrixModel = mongoose.models.MatrixIdentity || mongoose.model('MatrixIdentity', matrixSchema);

class MatrixDomain extends ManagableDomain {
    constructor(domainName, category) {
        super(domainName);
        this.category = category;
        const matrixConfig = config.matrix || {};
        
        this.homeserverUrl = matrixConfig.homeserverUrl || process.env.MATRIX_HOMESERVER_URL || 'https://matrix.valckenburgschule.de';
        this.sharedSecret = matrixConfig.sharedSecret || process.env.MATRIX_SHARED_SECRET;
        this.adminUsername = matrixConfig.adminUsername || process.env.MATRIX_ADMIN_USERNAME || 'synx.admin';
        this.adminPassword = matrixConfig.adminPassword || process.env.MATRIX_ADMIN_PASSWORD || 'Start123!';
        
        if (this.homeserverUrl && this.homeserverUrl.endsWith('/')) {
            this.homeserverUrl = this.homeserverUrl.slice(0, -1);
        }

        this.adminToken = null;
        this.tokenTime = 0;
        this.userMxids = {};
        this.homeserverDomain = null;
    }

    get homeserverDomainName() {
        return this.homeserverDomain || new URL(this.homeserverUrl).hostname;
    }

    get supportedProperties() {
        return ['userId', 'firstName', 'lastName'];
    }

    get cacheTTL() {
        return 3600000; // 1 hour
    }

    async ensureAdminToken() {
        if (this.adminToken && Date.now() - this.tokenTime < 1800000) {
            return this.adminToken;
        }

        // 1. Try to log in
        try {
            const loginUrl = `${this.homeserverUrl}/_matrix/client/v3/login`;
            const loginRes = await fetch(loginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'm.login.password',
                    identifier: {
                        type: 'm.id.user',
                        user: this.adminUsername
                    },
                    password: this.adminPassword
                })
            });

            if (loginRes.ok) {
                const data = await loginRes.json();
                this.adminToken = data.access_token;
                this.tokenTime = Date.now();
                if (data.user_id) {
                    this.homeserverDomain = data.user_id.split(':')[1];
                } else if (data.home_server) {
                    this.homeserverDomain = data.home_server;
                }
                return this.adminToken;
            }
        } catch (e) {
            // Ignore error, try register
        }

        // 2. Try to register
        try {
            await this.registerUser({
                username: this.adminUsername,
                password: this.adminPassword,
                isAdmin: true
            });
            
            // Login after registration
            const loginUrl = `${this.homeserverUrl}/_matrix/client/v3/login`;
            const loginRes = await fetch(loginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'm.login.password',
                    identifier: {
                        type: 'm.id.user',
                        user: this.adminUsername
                    },
                    password: this.adminPassword
                })
            });

            if (!loginRes.ok) {
                throw new Error(`Admin login failed: ${loginRes.statusText}`);
            }

            const data = await loginRes.json();
            this.adminToken = data.access_token;
            this.tokenTime = Date.now();
            if (data.user_id) {
                this.homeserverDomain = data.user_id.split(':')[1];
            } else if (data.home_server) {
                this.homeserverDomain = data.home_server;
            }
            return this.adminToken;
        } catch (err) {
            throw new Error(`Matrix admin authentication failed: ${err.message}`);
        }
    }

    async registerUser({ username, password, isAdmin = false }) {
        if (!this.homeserverUrl || !this.sharedSecret) {
            throw new Error('Matrix configuration is incomplete. Missing homeserverUrl or sharedSecret.');
        }

        const url = `${this.homeserverUrl}/_synapse/admin/v1/register`;
        
        const nonceResponse = await fetch(url);
        if (!nonceResponse.ok) {
            throw new Error(`Nonce-Abruf fehlgeschlagen: ${nonceResponse.statusText}`);
        }
        const { nonce } = await nonceResponse.json();
        
        const adminStr = isAdmin ? 'admin' : 'notadmin';
        const dataToSign = `${nonce}\x00${username}\x00${password}\x00${adminStr}`;
        
        const signature = crypto
            .createHmac('sha1', this.sharedSecret)
            .update(dataToSign)
            .digest('hex');
            
        const payload = {
            nonce,
            username,
            password,
            admin: isAdmin,
            mac: signature
        };
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Registrierung fehlgeschlagen (${response.status}): ${errorText}`);
        }
        
        return await response.json();
    }

    async readIdentities() {
        if (this.initFilter && typeof this.initFilter === 'function') {
            await this.initFilter();
        }

        const docs = await MatrixModel.find({ category: this.category }).lean();

        const identities = docs.map(doc => {
            const username = doc.login || doc.userId;
            return this.mapIdentity ? this.mapIdentity(username, doc.firstName, doc.lastName) : new Identity(doc.userId, doc.firstName, doc.lastName);
        }).filter(Boolean);

        identities.sort((a, b) => a.userId.localeCompare(b.userId));
        return identities;
    }

    async addIdentity(identity) {
        if (!this.homeserverUrl || !this.sharedSecret) {
            throw new Error('Matrix configuration is incomplete.');
        }

        const username = identity.login || identity.userId;
        const password = crypto.randomBytes(16).toString('hex');
        
        try {
            await this.registerUser({
                username,
                password,
                isAdmin: false
            });
        } catch (err) {
            // Ignore error if user is already registered in Matrix
            if (!err.message.includes('M_USER_IN_USE') && !err.message.includes('already exists')) {
                throw err;
            }
        }

        // Try to update display name on the Matrix server, but ignore failures since it might not be supported
        try {
            const token = await this.ensureAdminToken();
            const domain = this.homeserverDomainName;
            const mxid = `@${username}:${domain}`;
            const updateUrl = `${this.homeserverUrl}/_synapse/admin/v2/users/${encodeURIComponent(mxid)}`;
            const displayname = `${identity.firstName || ''} ${identity.lastName || ''}`.trim();
            
            await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    displayname
                })
            });
        } catch (e) {
            // Ignore display name updates if Admin User API is missing
        }

        // Save/Update in MongoDB
        await MatrixModel.updateOne(
            { userId: identity.userId, category: this.category },
            {
                $set: {
                    userId: identity.userId,
                    firstName: identity.firstName,
                    lastName: identity.lastName,
                    login: username,
                    category: this.category
                }
            },
            { upsert: true }
        );

        this.invalidate();
    }

    async changeIdentity(identity) {
        const username = identity.login || identity.userId;

        // Try to update display name on Matrix server, ignoring failures
        try {
            const token = await this.ensureAdminToken();
            const domain = this.homeserverDomainName;
            const mxid = `@${username}:${domain}`;
            const updateUrl = `${this.homeserverUrl}/_synapse/admin/v2/users/${encodeURIComponent(mxid)}`;
            const displayname = `${identity.firstName || ''} ${identity.lastName || ''}`.trim();
            
            await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    displayname
                })
            });
        } catch (e) {
            // Ignore
        }

        // Update in MongoDB
        await MatrixModel.updateOne(
            { userId: identity.userId, category: this.category },
            {
                $set: {
                    firstName: identity.firstName,
                    lastName: identity.lastName,
                    login: username
                }
            }
        );

        this.invalidate();
    }

    async removeIdentity(identity) {
        const username = identity.login || identity.userId;

        // Try to deactivate on Matrix server, ignoring failures
        try {
            const token = await this.ensureAdminToken();
            const domain = this.homeserverDomainName;
            const mxid = `@${username}:${domain}`;
            const deactivateUrl = `${this.homeserverUrl}/_synapse/admin/v1/deactivate/${encodeURIComponent(mxid)}`;
            
            await fetch(deactivateUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    erase: true
                })
            });
        } catch (e) {
            // Ignore
        }

        // Delete from MongoDB
        await MatrixModel.deleteOne({ userId: identity.userId, category: this.category });

        this.invalidate();
    }
}

module.exports = MatrixDomain;
