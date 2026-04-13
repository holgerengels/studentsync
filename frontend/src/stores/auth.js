import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('token'),
        refreshToken: localStorage.getItem('refreshToken'),
        user: JSON.parse(localStorage.getItem('user') || '{}'),
        showLogin: false
    }),

    getters: {
        isAuthenticated: (state) => !!state.token
    },

    actions: {
        login(token, user, refreshToken) {
            this.token = token;
            this.user = user;
            this.showLogin = false;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            if (refreshToken) {
                this.refreshToken = refreshToken;
                localStorage.setItem('refreshToken', refreshToken);
            }
        },

        logout() {
            this.token = null;
            this.refreshToken = null;
            this.user = {};
            this.showLogin = true;
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
        },

        triggerLogin() {
            this.showLogin = true;
        }
    }
})
