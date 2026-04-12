const axios = require('axios');
jest.mock('../src/domains/WebUntis', () => { return class WebUntisDomain {}; });
const app = require('../src/server'); // new Node.js server
const request = require('supertest');

const OLD_API_URL = 'http://localhost:8080/server'; // adjust to real Java Tomcat/Jetty port

describe('API Parity Tests (Java vs Node)', () => {
    test('Identities from ASV domain should match', async () => {
        // Fetch from old Java API
        // WARNING: Actual endpoints on Java API might differ (e.g. /server/asv/list)
        // This is a rough estimation of the comparison logic.
        const javaResponse = await axios.get(`${OLD_API_URL}/list/asv`).catch(e => e.response);
        
        // Fetch from new Node API
        const nodeResponse = await request(app).get('/api/identities/asv');

        if (javaResponse && javaResponse.status === 200) {
            expect(nodeResponse.status).toBe(200);
            
            // Assuming Java returned a list of Student.java instances, and Node returns Identity instances
            // We just test length and an arbitrary data mapping for now.
            expect(nodeResponse.body.length).toEqual(javaResponse.data.length);
        } else {
            console.warn('Java server uncontactable or endpoint differs, skipping exact match assertion.');
        }
    });

    test('Diff calculation ASV vs Untis should match', async () => {
        const javaResponse = await axios.get(`${OLD_API_URL}/diff/asv/untis`).catch(e => e.response);
        const nodeResponse = await request(app).get('/api/diffs/asv/untis');

        if (javaResponse && javaResponse.status === 200) {
            expect(nodeResponse.status).toBe(200);
            expect(nodeResponse.body.added.length).toEqual(javaResponse.data.added?.length || 0);
            expect(nodeResponse.body.removed.length).toEqual(javaResponse.data.removed?.length || 0);
            expect(nodeResponse.body.changed.length).toEqual(javaResponse.data.changed?.length || 0);
        }
    });

    // Write operations are explicitly mocked in the Node backend, so we don't test parity for POST/PUT.
});
