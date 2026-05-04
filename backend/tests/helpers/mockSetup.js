/**
 * Test helper that registers fresh MockDomain instances in the domain registry.
 * Call createMockDomains() in beforeEach to get isolated, clean mock domains per test.
 *
 * This is the central mechanism for running real tasks against mock backends.
 * Tasks use getDomain() from the registry, so they are agnostic about
 * whether a mock or a real backend is behind the domain.
 */
const { clearRegistry, registerDomain } = require('../../src/domains/registry');
const MockDomain = require('../../src/domains/mocks/MockDomain');
const { asvData, untisData, schulkonsoleData, nextcloudData, webuntisData } = require('../../src/domains/mocks/data');

function createMockDomains() {
    clearRegistry();

    const asv = new MockDomain('asv', asvData, ['userId', 'firstName', 'lastName', 'birthday', 'clazz']);
    const untis = new MockDomain('untis', untisData, ['userId', 'firstName', 'lastName', 'clazz']);
    const schulkonsole = new MockDomain('schulkonsole', schulkonsoleData, ['userId', 'firstName', 'lastName', 'clazz']);
    const webuntis = new MockDomain('webuntis', webuntisData, ['userId', 'firstName', 'lastName']);
    const nextcloud = new MockDomain('nextcloud', nextcloudData, ['userId', 'firstName', 'lastName', 'email']);
    const dummy = new MockDomain('dummy');

    // Add ASV-specific methods that tasks like IdGenerationTask expect
    const { encode, next } = require('../../src/utils/userIds');
    asv.generateIds = async function() {
        const generated = [];
        for (let user of this.data) {
            if (!user.userId && !user.account) {
                const len = 18;
                let like = encode(user.lastName);
                if (like.length > len - 6) like = like.substring(0, len - 6);
                const similar = this.data.filter(u => u.userId && u.userId.startsWith(like)).map(u => u.userId);
                const userid = next(len, similar, user.firstName, user.lastName);
                user.userId = userid;
                user.account = userid;
                generated.push({ id: user.id, account: userid, firstName: user.firstName, lastName: user.lastName });
            }
        }
        if (generated.length > 0) this.invalidate();
        return generated;
    };

    asv.readExitDates = async function() { return {}; };
    asv.readGuardians = async function() { return []; };

    const domains = { asv, untis, schulkonsole, webuntis, nextcloud, dummy };

    for (const domain of Object.values(domains)) {
        registerDomain(domain);
    }

    return domains;
}

module.exports = { createMockDomains };
