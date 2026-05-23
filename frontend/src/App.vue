<template>
  <div class="app-container" :class="{ 'with-sidebar': auth.isAuthenticated, 'sidebar-collapsed': !sidebarOpen && !isMobile }">
    
    <ToastContainer />
    
    <Login v-if="auth.showLogin" />

    <div v-if="isMobile && sidebarOpen && auth.isAuthenticated" class="sidebar-backdrop" @click="sidebarOpen = false"></div>

    <aside v-if="auth.isAuthenticated" class="sidebar" :class="{ 'mobile-open': sidebarOpen && isMobile, 'mobile-closed': !sidebarOpen && isMobile }">
      <div class="logo"><img src="/vu.svg" alt="Synx" height="44"/>&nbsp;SYNX</div>
      <nav v-if="config">
        <template v-for="cat in config.categories" :key="cat.name">
          <router-link :to="'/' + cat.name" class="nav-category" @click="closeMobileSidebar">
            {{ cat.label }}
          </router-link>
          <router-link 
            v-for="d in domainsByCategory(cat.name)" :key="d.name" 
            :to="'/domain/'+d.name" 
            class="nav-sub"
            @click="closeMobileSidebar">
              {{ d.titel || d.name }}
          </router-link>
          <router-link 
            v-for="df in diffsByCategory(cat.name)" :key="df.name" 
            :to="'/diff/'+df.name" 
            class="nav-sub"
            @click="closeMobileSidebar">
              {{ df.titel || df.name }}
          </router-link>
        </template>

        <span class="nav-spacer"></span>
        <router-link to="/logs" @click="closeMobileSidebar">Logs (History)</router-link>
      </nav>
      <div v-if="config?.devMode" class="dev-mode-badge">
        <span class="dev-dot"></span>
        DEV MODE
      </div>
      <div class="footer">
           <div class="user-info" v-if="auth.user && auth.user.username">
              <wa-avatar :initials="userInitials" shape="circle" size="small"></wa-avatar>
              <span class="nav-text">{{ auth.user.displayName || auth.user.username }}</span>
           </div>
          <wa-button appearance="plain" @click="auth.logout()" style="margin-left: auto;">
             <wa-icon name="box-arrow-right"></wa-icon>
          </wa-button>
      </div>
    </aside>
    
    <main class="main-content">
      <header v-if="auth.isAuthenticated" class="top-bar">
        <button title="Menu" style="font-size: 1.25rem; background: transparent; border: none; cursor: pointer; padding: 0.25rem;" @click="sidebarOpen = !sidebarOpen">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
            </svg>
        </button>
        <h2 class="top-bar-title">{{ currentCategoryLabel || 'Synx' }}</h2>
        <div class="top-bar-spacer"></div>
        <div v-if="currentCategoryName" class="investigate-bar">
          <wa-input size="small" placeholder="ID nachschlagen …" :value="investigateId" @wa-input="investigateId = $event.target.value" @input="investigateId = $event.target.value" @keydown.enter="runInvestigate" clearable>
            <wa-icon slot="prefix" name="search"></wa-icon>
          </wa-input>
          <wa-button size="small" variant="neutral" @click="runInvestigate" :loading="investigateLoading">
            <wa-icon slot="prefix" name="binoculars"></wa-icon>
            Investigate
          </wa-button>
        </div>
      </header>

      <!-- Investigate Results Dialog -->
      <wa-dialog label="Investigate" :open="investigateDialogOpen" @wa-after-hide="investigateDialogOpen = false" style="--width: 700px;">
        <div v-if="investigateResults" style="padding: 0.5rem;">
          <p style="margin-top: 0; color: var(--wa-color-neutral-500); font-size: 0.9em;">
            Ergebnis für <strong>{{ investigateResults.id }}</strong> in <em>{{ investigateResults.category }}</em>
          </p>
          <div v-for="r in investigateResults.results" :key="r.domain" class="investigate-result" :class="{ 'investigate-found': r.found, 'investigate-missing': !r.found }">
            <div class="investigate-domain" :style="{ borderLeftColor: r.color || 'var(--wa-color-neutral-300)' }">
              <span class="investigate-domain-name">{{ r.titel || r.domain }}</span>
              <wa-badge v-if="r.found" variant="success">gefunden</wa-badge>
              <wa-badge v-else-if="r.error" variant="danger">Fehler</wa-badge>
              <wa-badge v-else variant="neutral">nicht gefunden</wa-badge>
            </div>
            <div v-if="r.found && r.identity" class="investigate-identity">
              <div v-for="(val, key) in r.identity" :key="key" class="investigate-field">
                <span class="investigate-key">{{ key }}</span>
                <span class="investigate-val">{{ val !== null && val !== '' ? val : '-' }}</span>
              </div>
            </div>
            <div v-if="r.error" class="investigate-error">{{ r.error }}</div>
          </div>
        </div>
      </wa-dialog>
      <router-view></router-view>
    </main>

  </div>
</template>

<script setup>
import { inject, ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from './stores/auth';
import Login from './views/Login.vue';
import ToastContainer from './components/ToastContainer.vue';

const config = inject('synxConfig');
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

// Derive current category from route path
const currentCategoryName = computed(() => {
    const path = route.path;
    // Direct category route: /students, /teachers
    const cats = config?.categories || [];
    const directMatch = cats.find(c => path === `/${c.name}`);
    if (directMatch) return directMatch.name;
    // Domain route: /domain/asv-student → find domain config → category
    const domainMatch = path.match(/^\/domain\/(.+)/);
    if (domainMatch) {
        const d = (config?.domains || []).find(d => d.name === domainMatch[1]);
        if (d) return d.category;
    }
    // Diff route: /diff/asv-untis-students → find diff config → category
    const diffMatch = path.match(/^\/diff\/(.+)/);
    if (diffMatch) {
        const df = (config?.diffs || []).find(d => d.name === diffMatch[1]);
        if (df) return df.category;
    }
    return null;
});

const currentCategoryLabel = computed(() => {
    if (!currentCategoryName.value) return null;
    const cat = (config?.categories || []).find(c => c.name === currentCategoryName.value);
    return cat?.label || currentCategoryName.value;
});

// Investigate
const investigateId = ref('');
const investigateLoading = ref(false);
const investigateDialogOpen = ref(false);
const investigateResults = ref(null);

async function runInvestigate() {
    const id = investigateId.value.trim();
    if (!id || !currentCategoryName.value) return;
    investigateLoading.value = true;
    try {
        const res = await axios.get(`/api/investigate/${currentCategoryName.value}/${encodeURIComponent(id)}`);
        investigateResults.value = res.data;
        investigateDialogOpen.value = true;
    } catch (e) {
        console.error('Investigate failed:', e);
    } finally {
        investigateLoading.value = false;
    }
}

function domainsByCategory(cat) {
    return (config?.domains || []).filter(d => d.category === cat);
}

function diffsByCategory(cat) {
    return (config?.diffs || []).filter(d => d.category === cat);
}

const userInitials = computed(() => {
    const name = auth.user?.displayName || auth.user?.username;
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
});

const isMobile = ref(false);
const sidebarOpen = ref(true);

const handleResize = (e) => {
    isMobile.value = e.matches;
    if (e.matches) {
        sidebarOpen.value = false;
    } else {
        sidebarOpen.value = true;
    }
};

onMounted(() => {
    const mediaQuery = window.matchMedia('(max-width: 1000px)');
    isMobile.value = mediaQuery.matches;
    if (isMobile.value) {
        sidebarOpen.value = false;
    }
    mediaQuery.addEventListener('change', handleResize);
});

onUnmounted(() => {
    const mediaQuery = window.matchMedia('(max-width: 1000px)');
    mediaQuery.removeEventListener('change', handleResize);
});

function closeMobileSidebar() {
    if (isMobile.value) {
        sidebarOpen.value = false;
    }
}
</script>

<style>
body {
    margin: 0;
    font-family: var(--wa-font-sans), sans-serif;
    background-color: var(--wa-color-neutral-90);
    height: 100vh;
    width: 100vw;
    overflow: hidden;
}
#app {
    height: 100%;
    width: 100%;
}
.app-container {
    height: 100%;   
    width: 100%;
    display: flex;
    flex-direction: column;
}
.app-container.with-sidebar {
    flex-direction: row;
}

/* Sidebar Styles */
.sidebar {
    width: 240px;
    min-width: 240px;
    height: 100%;
    background-color: white;
    border-right: 1px solid var(--wa-color-neutral-80);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    box-shadow: 1px 0 10px rgba(0,0,0,0.02);
    transition: transform 0.3s ease;
    overflow-x: hidden;
    overflow-y: auto;
    white-space: nowrap;
    box-sizing: border-box;
}

.logo {
    font-size: 32px;
    line-height: 34px;
    font-weight: 800;
    margin-bottom: 1rem;
    padding: 0.5rem 1rem;
    color: var(--wa-color-brand-20);
    display: flex;
    align-items: center;
    justify-content: center;
}

nav {
    display: flex;
    flex-direction: column;
    flex: 1;
}
nav a {
    padding: 0.75rem 1.5rem;
    text-decoration: none;
    color: var(--wa-color-neutral-30);
    transition: all 0.2s ease;
    font-weight: 500;
}
nav a:hover, nav a.router-link-active {
    font-weight: 600;
}
nav a:hover {
    background-color: var(--wa-color-brand-90);
    color: var(--wa-color-brand-20);
    transform: translateX(2px);
}
nav a.router-link-active {
    background-color: var(--wa-color-brand-80);
    color: var(--wa-color-brand-15);
}
.nav-category {
    padding: 0.6rem 1.5rem;
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--wa-color-neutral-500);
    margin-top: 0.75rem;
}
.nav-category:first-child {
    margin-top: 0;
}
.nav-category:hover {
    color: var(--wa-color-brand-20);
}
.nav-category.router-link-active {
    color: var(--wa-color-brand-15);
    background-color: transparent;
}
.nav-sub {
    padding: 0.4rem 1.5rem 0.4rem 2.25rem;
    font-size: 0.9rem;
    font-weight: 400;
    color: var(--wa-color-neutral-400);
}
.nav-sub:hover {
    color: var(--wa-color-brand-20);
}
.nav-sub.router-link-active {
    color: var(--wa-color-brand-15);
    font-weight: 600;
}
.nav-spacer {
    flex: 1;
}

.dev-mode-badge {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: auto 1rem 0;
    padding: 0.35rem 0.75rem;
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    border: 1px solid #f59e0b;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #92400e;
    text-transform: uppercase;
}

.dev-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: #f59e0b;
    animation: dev-pulse 2s ease-in-out infinite;
}

@keyframes dev-pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
    50% { opacity: 0.6; box-shadow: 0 0 6px 2px rgba(245, 158, 11, 0.3); }
}

.footer {
    display: flex;
    align-items: center;
    padding: 1rem;
    margin-top: 0.75rem;
    border-top: 1px solid var(--wa-color-neutral-80);
}

.user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

/* Main Content */
.main-content {
    flex: 1;
    padding: 1rem;
    background-color: var(--wa-color-neutral-95);
    overflow-y: auto;
}

.top-bar {
    display: flex;
    align-items: center;
    padding-bottom: 0.75rem;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid var(--wa-color-neutral-200);
}
.top-bar-title {
    margin: 0;
    margin-left: 0.5rem;
    display: inline-block;
    vertical-align: middle;
    font-size: 1.1rem;
    text-transform: uppercase;
    color: var(--wa-color-neutral-600);
    letter-spacing: 1px;
    white-space: nowrap;
}
.top-bar-spacer {
    flex: 1;
}
.investigate-bar {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.investigate-bar wa-input {
    width: 180px;
}

/* Investigate Results Dialog */
.investigate-result {
    margin-bottom: 0.75rem;
}
.investigate-domain {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-left: 4px solid var(--wa-color-neutral-300);
    background: var(--wa-color-neutral-50);
    border-radius: 0 6px 6px 0;
}
.investigate-domain-name {
    font-weight: 600;
    font-size: 0.95rem;
}
.investigate-found .investigate-domain {
    background: rgba(16, 185, 129, 0.06);
}
.investigate-missing .investigate-domain {
    background: var(--wa-color-neutral-50);
}
.investigate-identity {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    padding: 0.4rem 0.75rem 0.4rem 1.5rem;
    font-size: 0.85rem;
}
.investigate-field {
    display: flex;
    gap: 0.3rem;
}
.investigate-key {
    color: var(--wa-color-neutral-500);
    font-weight: 500;
}
.investigate-key::after {
    content: ':';
}
.investigate-val {
    color: var(--wa-color-neutral-800);
}
.investigate-error {
    padding: 0.25rem 0.75rem 0.25rem 1.5rem;
    font-size: 0.85rem;
    color: var(--wa-color-danger-600);
}

/* Sidebar Collapsed State (Desktop) */
.app-container.sidebar-collapsed .sidebar {
    width: 0;
    min-width: 0;
    padding-left: 0;
    padding-right: 0;
    opacity: 0;
    border-right: none;
    pointer-events: none;
}

/* Mobile Adjustments */
.sidebar-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999;
    backdrop-filter: blur(2px);
}

@media (max-width: 1000px) {
    .app-container {
        position: relative;
    }

    .sidebar {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 240px;
        z-index: 1000;
        box-shadow: 2px 0 10px rgba(0,0,0,0.1);
        transform: translateX(0);
    }
    
    .sidebar.mobile-closed {
        transform: translateX(-100%);
        pointer-events: none;
    }

    .main-content {
        width: 100%;
        height: 100%;
    }
}
</style>
