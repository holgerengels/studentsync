<template>
  <div class="login-container">
    <wa-card class="login-card">
      <h2 style="margin-top: 0;">Synx Login</h2>
      <form @submit.prevent="handleLogin" class="login-form">
        <wa-input label="Username" v-model="username" required></wa-input>
        <wa-input type="password" label="Password" v-model="password" required></wa-input>
        
        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
        
        <wa-button type="submit" variant="primary" style="margin-top: 1rem;">Login</wa-button>
      </form>
    </wa-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const username = ref('');
const password = ref('');
const errorMsg = ref('');
const router = useRouter();

async function handleLogin() {
    errorMsg.value = '';
    try {
        await axios.post('/auth/login', {
            username: username.value,
            password: password.value
        });
        // On success, redirect to dashboard
        router.push('/');
    } catch(e) {
        errorMsg.value = e.response?.data?.error || 'Login failed';
    }
}
</script>

<style scoped>
.login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: var(--wa-color-neutral-100);
}
.login-card {
    width: 400px;
    padding: 1rem;
}
.login-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.error {
    color: var(--wa-color-danger-600);
    font-size: 0.9rem;
}
</style>
