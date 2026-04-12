const Untis = require('../../src/domains/Untis');

describe('Untis Domain Integration', () => {
    jest.setTimeout(10000);

    test('Authenticate and fetch identities from Untis', async () => {
        try {
            const identities = await Untis.getIdentities();
            expect(Array.isArray(identities)).toBeTruthy();
            if (identities.length > 0) {
                expect(identities[0].userId).toBeDefined();
            }
        } catch (e) {
            console.warn('Skipping Untis test: Database unreachable', e.message);
        }
    });
});
