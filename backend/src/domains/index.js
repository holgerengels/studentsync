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
        // Students
        asv: tryCreate('asv', () => require('../students/domains/ASV')),
        untis: tryCreate('untis', () => require('../students/domains/Untis')),
        schulkonsole: tryCreate('schulkonsole', () => require('../students/domains/Schulkonsole')),
        webuntis: tryCreate('webuntis', () => require('../students/domains/WebUntis')),
        nextcloud: tryCreate('nextcloud', () => require('../students/domains/Nextcloud')),
        dummy: tryCreate('dummy', () => new (require('../students/domains/DummyDomain'))()),
        // Teachers
        'asv-teacher': tryCreate('asv-teacher', () => require('../teachers/domains/ASVTeacher')),
        'untis-teacher': tryCreate('untis-teacher', () => require('../teachers/domains/UntisTeacher')),
        'schulkonsole-teacher': tryCreate('schulkonsole-teacher', () => require('../teachers/domains/SchulkonsoleTeacher')),
        'mailcow-teacher': tryCreate('mailcow-teacher', () => require('../teachers/domains/MailCowTeacher')),
        'verwaltungsnetz-teacher': tryCreate('verwaltungsnetz-teacher', () => require('../teachers/domains/VerwaltungsnetzTeacher')),
        // Fachnetz
        fachnetz: tryCreate('fachnetz', () => require('../fachnetz/domains/Fachnetz')),
        arbeitsheft: tryCreate('arbeitsheft', () => require('../fachnetz/domains/Arbeitsheft')),
        // Other
        relution: new Domain('relution')
    };

    // Remove failed domains
    for (const key of Object.keys(domains)) {
        if (domains[key] === null) delete domains[key];
    }
}

module.exports = {
    domains
};
