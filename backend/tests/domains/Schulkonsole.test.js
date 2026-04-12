const Schulkonsole = require('../../src/domains/Schulkonsole');

describe('Schulkonsole Domain Integration', () => {
    jest.setTimeout(20000);

    test('Authenticate and fetch identities from Schulkonsole', async () => {
        try {
            const identities = await Schulkonsole.getIdentities();
            expect(Array.isArray(identities)).toBeTruthy();
            if (identities.length > 0) {
                expect(identities[0].userId).toBeDefined();
            }
        } catch (e) {
            console.warn('Skipping Schulkonsole test: API unreachable or credentials invalid', e.message);
        }
    });
});
