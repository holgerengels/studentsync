import { createApp } from 'vue';
import { createPinia } from 'pinia';
import axios from 'axios';
import App from './App.vue';
import { createRouter, createWebHistory } from 'vue-router';
import './axios';

// Initialize Web Awesome locally
import '@awesome.me/webawesome/dist/styles/themes/default.css';
import { setBasePath } from '@awesome.me/webawesome/dist/utilities/base-path.js';
import { registerIconLibrary } from '@awesome.me/webawesome/dist/components/icon/library.js';
setBasePath('/');

registerIconLibrary('default', {
    resolver: name => `/icons/${name}.svg`
});

// Import used components
import '@awesome.me/webawesome/dist/components/card/card.js';
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/icon/icon.js';
import '@awesome.me/webawesome/dist/components/badge/badge.js';
import '@awesome.me/webawesome/dist/components/avatar/avatar.js';
import '@awesome.me/webawesome/dist/components/tooltip/tooltip.js';
import '@awesome.me/webawesome/dist/components/spinner/spinner.js';
import '@awesome.me/webawesome/dist/components/drawer/drawer.js';
import '@awesome.me/webawesome/dist/components/input/input.js';

import Dashboard from './views/Dashboard.vue';
import GenericDomainView from './views/GenericDomainView.vue';
import GenericDiffView from './views/GenericDiffView.vue';
import Login from './views/Login.vue';
import Logs from './views/Logs.vue';

// Pre-auth setup for axios to include credentials
axios.defaults.withCredentials = true;

async function bootstrap() {
    const app = createApp(App);
    const pinia = createPinia();
    app.use(pinia);

    // Fetch config for dynamic routing
    let remoteConfig = { domains: [], diffs: [], tasks: [] };
    try {
        const res = await axios.get('/api/config/ui');
        remoteConfig = res.data;
    } catch (e) {
        console.error("Failed to load config, starting with defaults", e);
    }

    // Pass the config down to app via Provide/Inject
    app.provide('synxConfig', remoteConfig);

    const dynamicRoutes = [];
    
    // Generate Routes from config
    remoteConfig.domains?.forEach(domain => {
        dynamicRoutes.push({
            path: `/domain/${domain.name}`,
            name: `domain-${domain.name}`,
            component: GenericDomainView,
            props: { domain }
        });
    });

    remoteConfig.diffs?.forEach(diff => {
        dynamicRoutes.push({
            path: `/diff/${diff.name}`,
            name: `diff-${diff.name}`,
            component: GenericDiffView,
            props: { diff }
        });
    });

    const routes = [
        { path: '/', name: 'Dashboard', component: Dashboard, props: { config: remoteConfig } },
        { path: '/login', name: 'Login', component: Login },
        { path: '/logs', name: 'Logs', component: Logs },
        ...dynamicRoutes
    ];

    const router = createRouter({
        history: createWebHistory(),
        routes,
    });

    // Relying on global Axios interceptors for 401 routing via Login Overlay

    app.use(router);
    app.mount('#app');
}

bootstrap();
