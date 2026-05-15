/**
 * Frontend tests for category-based access control.
 * 
 * Tests that the sidebar navigation and category filtering
 * correctly reflect the access-filtered config from the backend.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { nextTick, defineComponent, h } from 'vue';

// Stub component for route targets
const Stub = defineComponent({ render: () => h('div', 'stub') });

// Test configs representing different access scenarios
const fullAccessConfig = {
    categories: [
        { name: 'students', label: 'Schüler*innen' },
        { name: 'teachers', label: 'Lehrer*innen' },
        { name: 'fachnetz', label: 'Fachnetz' }
    ],
    domains: [
        { name: 'asv', titel: 'ASV', category: 'students' },
        { name: 'asv-teacher', titel: 'ASV Lehrkräfte', category: 'teachers' },
        { name: 'fachnetz', titel: 'Fachnetz', category: 'fachnetz' }
    ],
    diffs: [
        { name: 'asv-untis', titel: 'ASV → Untis', category: 'students', source: 'ASV', target: 'Untis' }
    ],
    devMode: true
};

const partialAccessConfig = {
    categories: [
        { name: 'students', label: 'Schüler*innen' }
    ],
    domains: [
        { name: 'asv', titel: 'ASV', category: 'students' }
    ],
    diffs: [],
    devMode: true
};

const noAccessConfig = {
    categories: [],
    domains: [],
    diffs: [],
    devMode: true
};

// Minimal sidebar component that mirrors App.vue's navigation logic
const SidebarNav = defineComponent({
    props: { config: Object },
    setup(props) {
        function domainsByCategory(catName) {
            return (props.config?.domains || []).filter(d => d.category === catName);
        }
        function diffsByCategory(catName) {
            return (props.config?.diffs || []).filter(d => d.category === catName);
        }
        return { domainsByCategory, diffsByCategory };
    },
    template: `
        <nav>
            <template v-for="cat in config?.categories" :key="cat.name">
                <a :href="'/' + cat.name" class="nav-category" :data-category="cat.name">
                    {{ cat.label }}
                </a>
                <a v-for="d in domainsByCategory(cat.name)" :key="d.name"
                   :href="'/domain/' + d.name" class="nav-sub" :data-domain="d.name">
                    {{ d.titel }}
                </a>
                <a v-for="df in diffsByCategory(cat.name)" :key="df.name"
                   :href="'/diff/' + df.name" class="nav-sub" :data-diff="df.name">
                    {{ df.titel }}
                </a>
            </template>
        </nav>
    `
});

describe('Sidebar Access Control', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    describe('Full access (holger_engels — all categories)', () => {
        it('should render all 3 category links', () => {
            const wrapper = mount(SidebarNav, { props: { config: fullAccessConfig } });
            const categories = wrapper.findAll('.nav-category');
            expect(categories).toHaveLength(3);
            expect(categories[0].text()).toBe('Schüler*innen');
            expect(categories[1].text()).toBe('Lehrer*innen');
            expect(categories[2].text()).toBe('Fachnetz');
        });

        it('should link categories to correct routes using name slug', () => {
            const wrapper = mount(SidebarNav, { props: { config: fullAccessConfig } });
            const categories = wrapper.findAll('.nav-category');
            expect(categories[0].attributes('href')).toBe('/students');
            expect(categories[1].attributes('href')).toBe('/teachers');
            expect(categories[2].attributes('href')).toBe('/fachnetz');
        });

        it('should render domains under correct categories', () => {
            const wrapper = mount(SidebarNav, { props: { config: fullAccessConfig } });
            const domains = wrapper.findAll('.nav-sub[data-domain]');
            expect(domains).toHaveLength(3);
            expect(domains.map(d => d.attributes('data-domain'))).toEqual(['asv', 'asv-teacher', 'fachnetz']);
        });

        it('should render diffs under correct categories', () => {
            const wrapper = mount(SidebarNav, { props: { config: fullAccessConfig } });
            const diffs = wrapper.findAll('.nav-sub[data-diff]');
            expect(diffs).toHaveLength(1);
            expect(diffs[0].attributes('data-diff')).toBe('asv-untis');
        });
    });

    describe('Partial access (only students)', () => {
        it('should render only 1 category', () => {
            const wrapper = mount(SidebarNav, { props: { config: partialAccessConfig } });
            const categories = wrapper.findAll('.nav-category');
            expect(categories).toHaveLength(1);
            expect(categories[0].text()).toBe('Schüler*innen');
        });

        it('should not show teachers or fachnetz domains', () => {
            const wrapper = mount(SidebarNav, { props: { config: partialAccessConfig } });
            const domains = wrapper.findAll('.nav-sub[data-domain]');
            expect(domains).toHaveLength(1);
            expect(domains[0].attributes('data-domain')).toBe('asv');
        });
    });

    describe('No access (empty config)', () => {
        it('should render no categories', () => {
            const wrapper = mount(SidebarNav, { props: { config: noAccessConfig } });
            expect(wrapper.findAll('.nav-category')).toHaveLength(0);
        });

        it('should render no domains or diffs', () => {
            const wrapper = mount(SidebarNav, { props: { config: noAccessConfig } });
            expect(wrapper.findAll('.nav-sub')).toHaveLength(0);
        });
    });
});

describe('Route Generation from Categories', () => {
    // Mimics the route generation logic from main.js
    function generateRoutes(config) {
        const categories = config.categories || [];
        const routes = [];

        categories.forEach(cat => {
            routes.push({
                path: `/${cat.name}`,
                name: `dashboard-${cat.name}`,
                component: Stub,
            });
        });

        config.domains?.forEach(d => {
            routes.push({
                path: `/domain/${d.name}`,
                name: `domain-${d.name}`,
                component: Stub,
            });
        });

        config.diffs?.forEach(df => {
            routes.push({
                path: `/diff/${df.name}`,
                name: `diff-${df.name}`,
                component: Stub,
            });
        });

        const defaultRedirect = categories.length > 0 ? `/${categories[0].name}` : '/logs';
        routes.unshift({ path: '/', redirect: defaultRedirect });

        return routes;
    }

    it('should generate routes only for accessible categories', () => {
        const routes = generateRoutes(partialAccessConfig);
        const dashboardRoutes = routes.filter(r => r.name?.startsWith('dashboard-'));
        expect(dashboardRoutes).toHaveLength(1);
        expect(dashboardRoutes[0].path).toBe('/students');
    });

    it('should generate routes for all categories when fully accessible', () => {
        const routes = generateRoutes(fullAccessConfig);
        const dashboardRoutes = routes.filter(r => r.name?.startsWith('dashboard-'));
        expect(dashboardRoutes).toHaveLength(3);
        expect(dashboardRoutes.map(r => r.path)).toEqual(['/students', '/teachers', '/fachnetz']);
    });

    it('should redirect / to first accessible category', () => {
        const routes = generateRoutes(fullAccessConfig);
        const rootRoute = routes.find(r => r.path === '/');
        expect(rootRoute.redirect).toBe('/students');
    });

    it('should redirect / to /logs when no categories are accessible', () => {
        const routes = generateRoutes(noAccessConfig);
        const rootRoute = routes.find(r => r.path === '/');
        expect(rootRoute.redirect).toBe('/logs');
    });

    it('should only include domain routes for accessible domains', () => {
        const routes = generateRoutes(partialAccessConfig);
        const domainRoutes = routes.filter(r => r.name?.startsWith('domain-'));
        expect(domainRoutes).toHaveLength(1);
        expect(domainRoutes[0].path).toBe('/domain/asv');
    });

    it('should not include teacher or fachnetz routes with partial access', () => {
        const routes = generateRoutes(partialAccessConfig);
        const allPaths = routes.map(r => r.path);
        expect(allPaths).not.toContain('/teachers');
        expect(allPaths).not.toContain('/fachnetz');
        expect(allPaths).not.toContain('/domain/asv-teacher');
    });
});
