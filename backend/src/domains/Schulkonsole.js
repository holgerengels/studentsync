const axios = require('axios');
const https = require('https');
const Identity = require('./Identity');
const config = require('../config');
const ManagableDomain = require('./ManagableDomain');

class Schulkonsole extends ManagableDomain {
    get supportedProperties() { return ['userId', 'firstName', 'lastName', 'clazz']; }
    get cacheTTL() { return 3600000; } // 1 hour

    constructor() {
        super('schulkonsole');
        const c = config.schulkonsole || {};
        this.apiURL = c.apiURL || process.env.SCHULKONSOLE_API || 'https://localhost:43001/api/';
        if (!this.apiURL.endsWith('/')) this.apiURL += '/';
        
        this.tokenURL = c.tokenURL || process.env.SCHULKONSOLE_TOKEN_URL || 'https://localhost:43001/api/token';
        this.user = c.user || process.env.SCHULKONSOLE_USER || 'admin';
        this.password = c.password || process.env.SCHULKONSOLE_PASSWORD || 'secret';
        
        this.axiosInstance = axios.create({
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });

        this.classes = {}; // maps lowercase name to ID
        this.studentIds = {}; // maps lowercase account to ID
    }

    async authenticate() {
        if (this.authHeader && Date.now() - this.authTime < 3600000) return;
        const tokenRes = await this.axiosInstance.post(this.tokenURL, {
            grant_type: 'password', username: this.user, password: this.password
        }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});
        this.authHeader = `${tokenRes.data.token_type} ${tokenRes.data.access_token}`;
        this.authTime = Date.now();

        // Ensure classes are loaded alongside auth
        await this.loadClasses();
    }

    async loadClasses() {
        const classRes = await this.axiosInstance.get(`${this.apiURL}school/schoolClasses`, {
            headers: { 'Authorization': this.authHeader }
        });
        this.classes = {};
        classRes.data.forEach(c => this.classes[c.name.toLowerCase()] = c.id);
    }

    async readIdentities() {
        try {
            await this.authenticate();
            const stdRes = await this.axiosInstance.get(`${this.apiURL}students`, {
                headers: { 'Authorization': this.authHeader }
            });

            this.studentIds = {};
            return stdRes.data.map(r => {
                this.studentIds[r.userName.toLowerCase()] = r.id;
                // Reverse lookup the class ID back to its string name for Identity construction
                const className = Object.keys(this.classes).find(key => this.classes[key] === parseInt(r.schoolClass) || this.classes[key] === r.schoolClass) || r.schoolClass;
                return new Identity(
                    r.userName,
                    r.givenName,
                    r.surname,
                    {
                        id: r.id,
                        clazz: (className || '').toUpperCase()
                    }
                );
            });
        } catch (e) {
            console.error('Schulkonsole read error:', e.message);
            throw new Error('Schulkonsole read error: ' + e.message);
        }
    }

    async addClass(className) {
        await this.authenticate();
        let classId = this.classes[className.toLowerCase()];
        if (classId) return classId; // already exists

        const payload = { 
            name: className,
            schoolTypeId: 1,
            schoolYear: "2025"
        };
        const res = await this.axiosInstance.post(`${this.apiURL}school/schoolClasses`, payload, {
            headers: { 'Authorization': this.authHeader }
        });
        
        classId = res.data.id;
        this.classes[className.toLowerCase()] = classId;
        return classId;
    }

    async removeClass(className) {
        await this.authenticate();
        let classId = this.classes[className.toLowerCase()];
        if (!classId) return; // does not exist

        await this.axiosInstance.delete(`${this.apiURL}school/schoolClasses`, {
            headers: { 'Authorization': this.authHeader },
            data: [ classId ]
        });
        
        delete this.classes[className.toLowerCase()];
    }

    async addIdentity(identity) {
        await this.authenticate();
        const classId = this.classes[(identity.clazz || '').toLowerCase()];
        if (!classId) throw new Error(`Class ${identity.clazz} not found in Schulkonsole. Call addClass first.`);
        
        const payload = {
            schoolType: "1", comments: "", externalIdentifier: "", mySite: "",
            userName: identity.userId, givenName: identity.firstName, surname: identity.lastName,
            schoolClass: classId.toString(),
            isInternetLocked: false, isDeactivated: false, homeDirectory: "",
            password: config.schulkonsole?.initialPassword || "Start123!",
            passwordPolicy: "1",
            email: `${identity.userId}@musterschule.schule.paedml`
        };
        
        const res = await this.axiosInstance.post(`${this.apiURL}students`, payload, {
            headers: { 'Authorization': this.authHeader }
        });
        if (res.data && res.data.id) {
            this.studentIds[identity.userId.toLowerCase()] = res.data.id;
        }
        return res.data;
    }

    async changeIdentity(identity) {
        await this.authenticate();
        const existingId = this.studentIds[identity.userId.toLowerCase()];
        if (!existingId) throw new Error(`Student ${identity.userId} not found. Must run getIdentities() first.`);

        const classId = this.classes[(identity.clazz || '').toLowerCase()];
        
        const payload = {
            schoolType: "1", comments: "", externalIdentifier: "", mySite: "",
            userName: identity.userId, givenName: identity.firstName, surname: identity.lastName,
            schoolClass: classId ? classId.toString() : "",
            isInternetLocked: false, isDeactivated: false,
            homeDirectory: `\\\\SP01\\MLData\\Benutzer\\SUS\\${identity.userId}`
        };
        
        await this.axiosInstance.put(`${this.apiURL}students/${existingId}`, payload, {
            headers: { 'Authorization': this.authHeader }
        });
    }

    async removeIdentity(identity) {
        await this.authenticate();
        const existingId = this.studentIds[identity.userId.toLowerCase()];
        if (!existingId) return; // Ignore if already not existing

        await this.axiosInstance.delete(`${this.apiURL}students`, {
            headers: { 'Authorization': this.authHeader },
            data: [ existingId ]
        });
        
        delete this.studentIds[identity.userId.toLowerCase()];
    }
}

module.exports = new Schulkonsole();
