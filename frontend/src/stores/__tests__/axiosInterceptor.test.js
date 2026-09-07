import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import '../../axios';
import { useAuthStore } from '../auth';
import { useRequestQueueStore } from '../requestQueue';

describe('Axios Interceptor 401 handling', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.clear();
    });

    it('should clear authentication and reject when skipAuthQueue is true', async () => {
        const auth = useAuthStore();
        auth.token = 'expired-token';
        auth.showLogin = false;

        const errorResponse = {
            response: { status: 401 },
            config: { url: '/api/config/ui', skipAuthQueue: true, headers: {} }
        };

        // Get the response interceptor error handler
        const interceptor = axios.interceptors.response.handlers[0].rejected;

        await expect(interceptor(errorResponse)).rejects.toEqual(errorResponse);
        expect(auth.token).toBeNull();
        expect(auth.showLogin).toBe(true);
    });

    it('should add to requestQueue when skipAuthQueue is false', async () => {
        const auth = useAuthStore();
        const requestQueue = useRequestQueueStore();
        auth.token = 'expired-token';

        const errorResponse = {
            response: { status: 401 },
            config: { url: '/api/data', skipAuthQueue: false, headers: {} }
        };

        const interceptor = axios.interceptors.response.handlers[0].rejected;

        const promise = interceptor(errorResponse);
        expect(requestQueue.queue).toHaveLength(1);
        expect(auth.token).toBeNull();
        expect(auth.showLogin).toBe(true);
    });
});
