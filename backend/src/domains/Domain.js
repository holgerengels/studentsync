class Domain {
    constructor(domainName) {
        this.domainName = domainName;
        this.identities = undefined;
    }

    get supportedProperties() {
        return ['userId', 'firstName', 'lastName'];
    }

    invalidate() {
        this.identities = undefined;
        console.log(`[Domain] Identities invalidated for '${this.domainName}'`);
    }

    async getIdentities() {
        if (this.identities === undefined) {
             this.identities = await this.readIdentities();
        }
        return this.identities;
    }

    async readIdentities() {
        throw new Error(`[Domain] readIdentities() is not implemented for domain '${this.domainName}'`);
    }
}

module.exports = Domain;
