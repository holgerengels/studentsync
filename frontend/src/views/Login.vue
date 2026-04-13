<template>
  <div class="login-overlay">
    <wa-card class="login-card">
      <h2 style="margin-top: 0; display: flex; align-items: center; justify-content: space-between;">
        <span>Synx Login</span>
        <wa-icon v-if="loading" name="arrow-clockwise" class="spin"></wa-icon>
      </h2>
      <p style="margin-top: 0; color: #666; font-size: 0.9em;">Session abgelaufen oder nicht angemeldet</p>
      <form @submit.prevent="handleLogin" class="login-form">
        <wa-input label="Benutzername" v-model="username" required :disabled="loading"></wa-input>
        <wa-input type="password" label="Passwort" v-model="password" required :disabled="loading"></wa-input>
        
        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
        
        <wa-button type="submit" variant="primary" style="margin-top: 1rem;" :disabled="loading">Anmelden</wa-button>
      </form>
    </wa-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';
import { useRequestQueueStore } from '../stores/requestQueue';
import { useRouter } from 'vue-router';

const username = ref('');
const password = ref('');
const errorMsg = ref('');
const loading = ref(false);

const auth = useAuthStore();
const requestQueue = useRequestQueueStore();
const router = useRouter();

async function handleLogin() {
    errorMsg.value = '';
    loading.value = true;
    try {
        const res = await axios.post('/api/login', {
            username: username.value,
            password: password.value
        });
        
        const { token, user, refreshToken } = res.data;
        auth.login(token, user, refreshToken);
        
        // Retry any queued requests that failed due to 401
        requestQueue.retryAll(token);
        
        if (router.currentRoute.value.path === '/login') {
            router.push('/');
        }
    } catch(e) {
        errorMsg.value = e.response?.data?.error || e.response?.data?.message || 'Zugriff verweigert (LDAP oder Auth fehlgeschlagen)';
    } finally {
        loading.value = false;
    }
}
</script>

<style scoped>
.login-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.85); /* Semi-transparent like Tix */
    backdrop-filter: blur(8px);
    z-index: 9999;
}
.login-card {
    width: 100%;
    max-width: 400px;
    padding: 1rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}
.login-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.error {
    color: var(--wa-color-danger-600);
    font-size: 0.9rem;
    background: var(--wa-color-danger-100);
    padding: 0.5rem;
    border-radius: 4px;
}
.spin::part(base) {
    animation: spin 1s linear infinite;
}
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
</style>
