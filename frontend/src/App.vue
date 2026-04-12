<template>
  <div class="app-container" :class="{ 'with-sidebar': true, 'sidebar-collapsed': !sidebarOpen && !isMobile }">
    
    <div v-if="isMobile && sidebarOpen" class="sidebar-backdrop" @click="sidebarOpen = false"></div>

    <aside class="sidebar" :class="{ 'mobile-open': sidebarOpen && isMobile, 'mobile-closed': !sidebarOpen && isMobile }">
      <div class="logo"><img src="/vu.svg" alt="Synx" height="44"/>&nbsp;Synx</div>
      <nav v-if="config">
        <router-link to="/" @click="closeMobileSidebar">Dashboard</router-link>
        <router-link to="/logs" @click="closeMobileSidebar">Logs (History)</router-link>
        <span class="nav-header">Domains</span>
        <router-link v-for="d in config.domains" :key="d.name" :to="'/domain/'+d.name" @click="closeMobileSidebar">
            {{ d.titel || d.name }}
        </router-link>
        
        <span class="nav-header">Diffs</span>
        <router-link v-for="df in config.diffs" :key="df.name" :to="'/diff/'+df.name" @click="closeMobileSidebar">
            {{ df.titel || df.name }}
        </router-link>
      </nav>
      <div class="footer" style="padding: 1rem; margin-top: auto;">
          <wa-button @click="logout" size="small" variant="neutral" style="width: 100%;">Logout</wa-button>
      </div>
    </aside>
    
    <main class="main-content">
      <header class="top-bar">
        <button title="Menu" style="font-size: 1.5rem; background: transparent; border: none; cursor: pointer; padding: 0.5rem;" @click="sidebarOpen = !sidebarOpen">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
            </svg>
        </button>
        <h2 style="margin: 0; margin-left: 0.5rem; display: inline-block; vertical-align: bottom;">Synx</h2>
      </header>
      <router-view></router-view>
    </main>

  </div>
</template>

<script setup>
import { inject, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const config = inject('synxConfig');
const router = useRouter();

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

async function logout() {
    await axios.post('/auth/logout');
    router.push('/login');
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
.nav-header {
    padding: 1.5rem 1.5rem 0.25rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    color: var(--wa-color-neutral-500);
    letter-spacing: 0.5px;
}

/* Main Content */
.main-content {
    flex: 1;
    padding: 1.5rem;
    background-color: var(--wa-color-neutral-95);
    overflow-y: auto;
}

.top-bar {
    display: flex;
    align-items: center;
    padding-bottom: 1.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--wa-color-neutral-200);
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
