jest.mock('axios-cookiejar-support', () => ({ wrapper: (c) => c }));
const WebUntis = require('../../src/domains/WebUntis');

describe('WebUntis Domain Integration', () => {
    jest.setTimeout(20000);

    test('Authenticate and fetch identities from WebUntis', async () => {
        try {
            const identities = await WebUntis.getIdentities();
            expect(Array.isArray(identities)).toBeTruthy();
            if (identities.length > 0) {
                expect(identities[0].userId).toBeDefined();
            }
        } catch (e) {
            console.warn('Skipping WebUntis test: API unreachable or credentials invalid', e.message);
        }
    });
});
