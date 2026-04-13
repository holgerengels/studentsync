import axios from 'axios';
import { useAuthStore } from './stores/auth';
import { useRequestQueueStore } from './stores/requestQueue';

// Request interceptor to add token
axios.interceptors.request.use(config => {
    const auth = useAuthStore();
    if (auth.token) {
        config.headers.Authorization = `Bearer ${auth.token}`;
    }
    return config;
});

let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = (token) => {
    refreshSubscribers.forEach(cb => cb(token));
    refreshSubscribers = [];
};

const onRefreshFailed = () => {
    refreshSubscribers = [];
};

const addRefreshSubscriber = (callback) => {
    refreshSubscribers.push(callback);
};

// Response interceptor to handle 401
axios.interceptors.response.use(
    response => response,
    async error => {
        if (error.response && error.response.status === 401 && !error.config.url.endsWith('/login') && !error.config.url.endsWith('/refresh')) {
            const auth = useAuthStore();
            const requestQueue = useRequestQueueStore();
            const originalRequest = error.config;

            if (auth.refreshToken) {
                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        addRefreshSubscriber((newToken) => {
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;
                            axios(originalRequest).then(resolve).catch(reject);
                        });
                    });
                }

                isRefreshing = true;
                try {
                    const res = await axios.post('/api/refresh', { refreshToken: auth.refreshToken });
                    const { token, user } = res.data;
                    auth.login(token, user);
                    isRefreshing = false;
                    onRefreshed(token);

                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return axios(originalRequest);
                } catch (refreshError) {
                    isRefreshing = false;
                    onRefreshFailed();
                }
            }

            // Fallback to login overlay
            auth.triggerLogin();
            return new Promise((resolve, reject) => {
                requestQueue.add((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    axios(originalRequest).then(resolve).catch(reject);
                });
            });
        }
        
        return Promise.reject(error);
    }
);
