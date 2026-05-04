const useMocks = process.env.MOCK_DOMAINS === 'true';

let domains;

if (useMocks) {
    domains = require('./mocks/index');
    console.log('[Domains] Running in MOCK_DOMAINS mode. Using mock domains.');
} else {
    const Domain = require('./Domain');

    function tryCreate(name, factory) {
        try {
            return factory();
        } catch (e) {
            console.warn(`[Domains] Failed to initialize '${name}': ${e.message}`);
            return null;
        }
    }

    domains = {
        asv:          tryCreate('asv', () => require('./ASV')),
        untis:        tryCreate('untis', () => require('./Untis')),
        schulkonsole: tryCreate('schulkonsole', () => require('./Schulkonsole')),
        webuntis:     tryCreate('webuntis', () => require('./WebUntis')),
        nextcloud:    tryCreate('nextcloud', () => require('./Nextcloud')),
        dummy:        tryCreate('dummy', () => new (require('./DummyDomain'))()),
        relution:     new Domain('relution')
    };

    // Remove failed domains
    for (const key of Object.keys(domains)) {
        if (domains[key] === null) delete domains[key];
    }
}

module.exports = {
    domains
};
