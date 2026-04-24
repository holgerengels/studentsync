import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from './views/Dashboard.vue';
import Settings from './views/Settings.vue';
import Logs from './views/Logs.vue';

const routes = [
  { path: '/', component: Dashboard },
  { path: '/logs', component: Logs },
  { path: '/settings', component: Settings },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
