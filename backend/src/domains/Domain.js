class Domain {
    constructor(domainName) {
        this.domainName = domainName;
        this.identities = undefined;
        this._fetchPromise = null;
    }

    get supportedProperties() {
        return ['userId', 'firstName', 'lastName'];
    }

    invalidate() {
        this.identities = undefined;
        this._fetchPromise = null;
        console.log(`[Domain] Identities invalidated for '${this.domainName}'`);
    }

    async getIdentities() {
        if (this.identities !== undefined) {
             return this.identities;
        }
        
        if (!this._fetchPromise) {
             this._fetchPromise = this.readIdentities()
                 .then(data => {
                     this.identities = data;
                     return data;
                 })
                 .catch(err => {
                     this._fetchPromise = null; // Erlaubt einen neuen Versuch bei Fehlern
                     throw err;
                 });
        }
        
        return this._fetchPromise;
    }

    async readIdentities() {
        throw new Error(`[Domain] readIdentities() is not implemented for domain '${this.domainName}'`);
    }
}

module.exports = Domain;
