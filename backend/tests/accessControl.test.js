/**
 * Tests for category-based access control on /api/config/ui
 *
 * Verifies that the endpoint filters categories, domains and diffs
 * based on the authenticated user's groups and username.
 */

process.env.JWT_SECRET = 'test_secret';
process.env.REFRESH_JWT_SECRET = 'test_refresh_secret';

const jwt = require('jsonwebtoken');

// Mock ldapjs (required by auth.js even when not using LDAP)
jest.mock('ldapjs', () => ({
    createClient: jest.fn(() => ({
        on: jest.fn(),
        bind: jest.fn(),
        search: jest.fn(),
        unbind: jest.fn()
    }))
}));

// Mock config with categories, domains and diffs matching the real config.json structure
jest.mock('../src/config', () => ({
    settings: { devMode: true },
    categories: [
        {
            name: 'students',
            label: 'Schüler*innen',
            access: [{ group: 'Abteilungsleitung' }, { group: 'Netzwerkteam' }]
        },
        {
            name: 'teachers',
            label: 'Lehrer*innen',
            access: [{ group: 'Abteilungsleitung' }, { group: 'Netzwerkteam' }]
        },
        {
            name: 'fachnetz',
            label: 'Fachnetz',
            access: [{ user: 'holger_engels' }]
        }
    ],
    domains: [
        { name: 'asv', titel: 'ASV', category: 'students' },
        { name: 'untis', titel: 'Untis', category: 'students' },
        { name: 'asv-teacher', titel: 'ASV Lehrkräfte', category: 'teachers' },
        { name: 'fachnetz', titel: 'Fachnetz', category: 'fachnetz' }
    ],
    diffs: [
        { name: 'asv-untis', titel: 'ASV → Untis', category: 'students', source: 'ASV', target: 'Untis' },
        { name: 'asv-teacher--untis-teacher', titel: 'ASV → Untis Lehrkräfte', category: 'teachers', source: 'ASV', target: 'Untis' }
    ],
    tasks: [{ name: 'some-task', class: 'SyncTask' }]
}));

// Mock domains/registry to avoid real DB connections when routes.js loads
jest.mock('../src/domains/registry', () => ({
    getDomain: jest.fn(),
    getAllDomains: jest.fn(() => ({})),
    registerDomain: jest.fn(),
    clearRegistry: jest.fn()
}));

// Mock mongoose to prevent real DB connection
jest.mock('mongoose', () => ({
    connect: jest.fn().mockResolvedValue(null),
    connection: { readyState: 0, close: jest.fn() },
    Schema: jest.fn().mockImplementation(() => ({})),
    model: jest.fn().mockReturnValue({}),
}));

const express = require('express');
const request = require('supertest');
const routes = require('../src/routes');

// Build a minimal test app
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api', routes);
    return app;
}

function tokenFor(username, groups) {
    return jwt.sign({ username, groups }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('GET /api/config/ui — Access Control', () => {
    let app;

    beforeAll(() => {
        app = createTestApp();
    });

    it('should return 401 without a token', async () => {
        const res = await request(app).get('/api/config/ui');
        expect(res.status).toBe(401);
    });

    describe('holger_engels (Abteilungsleitung + Netzwerkteam)', () => {
        let res;
        beforeAll(async () => {
            const token = tokenFor('holger_engels', ['Abteilungsleitung', 'Netzwerkteam']);
            res = await request(app)
                .get('/api/config/ui')
                .set('Authorization', `Bearer ${token}`);
        });

        it('should return 200', () => {
            expect(res.status).toBe(200);
        });

        it('should see all 3 categories', () => {
            const names = res.body.categories.map(c => c.name);
            expect(names).toEqual(['students', 'teachers', 'fachnetz']);
        });

        it('should see labels for categories', () => {
            const labels = res.body.categories.map(c => c.label);
            expect(labels).toEqual(['Schüler*innen', 'Lehrer*innen', 'Fachnetz']);
        });

        it('should see all domains', () => {
            expect(res.body.domains).toHaveLength(4);
        });

        it('should see all diffs', () => {
            expect(res.body.diffs).toHaveLength(2);
        });

        it('should include tasks unfiltered', () => {
            expect(res.body.tasks).toHaveLength(1);
        });
    });

    describe('admin (Administration group — no matching access)', () => {
        let res;
        beforeAll(async () => {
            const token = tokenFor('admin', ['Administration']);
            res = await request(app)
                .get('/api/config/ui')
                .set('Authorization', `Bearer ${token}`);
        });

        it('should return 200', () => {
            expect(res.status).toBe(200);
        });

        it('should see no categories', () => {
            expect(res.body.categories).toEqual([]);
        });

        it('should see no domains', () => {
            expect(res.body.domains).toEqual([]);
        });

        it('should see no diffs', () => {
            expect(res.body.diffs).toEqual([]);
        });
    });

    describe('User with only Netzwerkteam group', () => {
        let res;
        beforeAll(async () => {
            const token = tokenFor('netzwerk_user', ['Netzwerkteam']);
            res = await request(app)
                .get('/api/config/ui')
                .set('Authorization', `Bearer ${token}`);
        });

        it('should see students and teachers but not fachnetz', () => {
            const names = res.body.categories.map(c => c.name);
            expect(names).toEqual(['students', 'teachers']);
            expect(names).not.toContain('fachnetz');
        });

        it('should see only students and teachers domains', () => {
            const categories = [...new Set(res.body.domains.map(d => d.category))];
            expect(categories).toContain('students');
            expect(categories).toContain('teachers');
            expect(categories).not.toContain('fachnetz');
        });

        it('should see only students and teachers diffs', () => {
            const categories = [...new Set(res.body.diffs.map(d => d.category))];
            expect(categories).not.toContain('fachnetz');
        });
    });

    describe('holger_engels without any groups (user-based access)', () => {
        let res;
        beforeAll(async () => {
            const token = tokenFor('holger_engels', []);
            res = await request(app)
                .get('/api/config/ui')
                .set('Authorization', `Bearer ${token}`);
        });

        it('should see only fachnetz (user-based rule match)', () => {
            const names = res.body.categories.map(c => c.name);
            expect(names).toEqual(['fachnetz']);
        });

        it('should see only fachnetz domains', () => {
            expect(res.body.domains).toHaveLength(1);
            expect(res.body.domains[0].name).toBe('fachnetz');
        });
    });

    describe('User with no groups and no user-based rules', () => {
        let res;
        beforeAll(async () => {
            const token = tokenFor('random_user', []);
            res = await request(app)
                .get('/api/config/ui')
                .set('Authorization', `Bearer ${token}`);
        });

        it('should see nothing', () => {
            expect(res.body.categories).toEqual([]);
            expect(res.body.domains).toEqual([]);
            expect(res.body.diffs).toEqual([]);
        });
    });

    it('should not leak access rules to the frontend', async () => {
        const token = tokenFor('holger_engels', ['Abteilungsleitung', 'Netzwerkteam']);
        const res = await request(app)
            .get('/api/config/ui')
            .set('Authorization', `Bearer ${token}`);

        // Categories sent to frontend should only have name and label, not access rules
        res.body.categories.forEach(cat => {
            expect(cat).toHaveProperty('name');
            expect(cat).toHaveProperty('label');
            expect(cat).not.toHaveProperty('access');
        });
    });
});
