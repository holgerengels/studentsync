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
             const promise = this.readIdentities()
                 .then(data => {
                     // Check if this promise is still the active one before caching
                     if (this._fetchPromise === promise) {
                         this.identities = data;
                     }
                     return data;
                 })
                 .catch(err => {
                     if (this._fetchPromise === promise) {
                         this._fetchPromise = null; // Erlaubt einen neuen Versuch bei Fehlern
                     }
                     throw err;
                 });
             this._fetchPromise = promise;
        }
        
        return this._fetchPromise;
    }

    async readIdentities() {
        throw new Error(`[Domain] readIdentities() is not implemented for domain '${this.domainName}'`);
    }
}

module.exports = Domain;
