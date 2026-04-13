import { defineStore } from 'pinia'

export const useRequestQueueStore = defineStore('requestQueue', {
    state: () => ({
        queue: []
    }),

    actions: {
        add(requestFactory) {
            this.queue.push(requestFactory);
        },

        retryAll(token) {
            console.log(`Retrying ${this.queue.length} failed requests...`);
            this.queue.forEach(factory => factory(token));
            this.queue = [];
        },

        clear() {
            this.queue = [];
        }
    }
})
