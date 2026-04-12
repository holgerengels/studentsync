import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from './views/Dashboard.vue';
import Domains from './views/Domains.vue';
import Diffs from './views/Diffs.vue';
import Settings from './views/Settings.vue';
import Remnants from './views/Remnants.vue';
import Logs from './views/Logs.vue';

const routes = [
  { path: '/', component: Dashboard },
  { path: '/domains', component: Domains },
  { path: '/diffs', component: Diffs },
  { path: '/remnants', component: Remnants },
  { path: '/logs', component: Logs },
  { path: '/settings', component: Settings },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
