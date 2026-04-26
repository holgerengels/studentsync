const ManagableDomain = require('../ManagableDomain');
const Identity = require('../Identity');

class MockDomain extends ManagableDomain {
    constructor(domainName, initialData = [], supportedProperties = ['userId', 'firstName', 'lastName']) {
        super(domainName);
        this.data = initialData.map(d => new Identity(d.userId || d.account, d.firstName, d.lastName, d));
        this._supportedProperties = supportedProperties;
    }

    get supportedProperties() {
        return this._supportedProperties;
    }

    async readIdentities() {
        return this.data;
    }

    async addIdentity(identity) {
        const newId = new Identity(identity.userId || identity.account, identity.firstName, identity.lastName, identity);
        this.data.push(newId);
        this.invalidate();
    }

    async changeIdentity(identity) {
        const idKey = identity.userId || identity.account;
        const index = this.data.findIndex(u => (u.userId && u.userId === idKey) || (u.account && u.account === idKey));
        if (index !== -1) {
            this.data[index] = new Identity(idKey, identity.firstName, identity.lastName, { ...this.data[index], ...identity });
            this.invalidate();
        } else {
            throw new Error(`Identity not found in mock domain ${this.domainName}`);
        }
    }

    async removeIdentity(identity) {
        const idKey = identity.userId || identity.account;
        this.data = this.data.filter(u => u.userId !== idKey && u.account !== idKey);
        this.invalidate();
    }
}

module.exports = MockDomain;
