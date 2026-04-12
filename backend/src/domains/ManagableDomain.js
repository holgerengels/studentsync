const Domain = require('./Domain');

class ManagableDomain extends Domain {
    constructor(domainName) {
        super(domainName);
    }

    async addIdentity(identity) {
        console.warn(`[ManagableDomain] addIdentity() is not implemented for domain '${this.domainName}'`);
        throw new Error('Not implemented');
    }

    async changeIdentity(identity) {
        console.warn(`[ManagableDomain] changeIdentity() is not implemented for domain '${this.domainName}'`);
        throw new Error('Not implemented');
    }

    async removeIdentity(identity) {
        console.warn(`[ManagableDomain] removeIdentity() is not implemented for domain '${this.domainName}'`);
        throw new Error('Not implemented');
    }
}

module.exports = ManagableDomain;
