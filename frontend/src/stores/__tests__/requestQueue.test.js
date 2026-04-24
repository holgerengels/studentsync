import { setActivePinia, createPinia } from 'pinia';
import { useRequestQueueStore } from '../requestQueue';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('requestQueue Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('should initialize with an empty queue', () => {
        const store = useRequestQueueStore();
        expect(store.queue).toEqual([]);
    });

    it('should add requests to the queue', () => {
        const store = useRequestQueueStore();
        const mockFn1 = vi.fn();
        const mockFn2 = vi.fn();

        store.add(mockFn1);
        store.add(mockFn2);

        expect(store.queue).toHaveLength(2);
        expect(store.queue[0]).toBe(mockFn1);
        expect(store.queue[1]).toBe(mockFn2);
    });

    it('should retry all requests with a token and clear the queue', () => {
        const store = useRequestQueueStore();
        const mockFn1 = vi.fn();
        const mockFn2 = vi.fn();

        store.add(mockFn1);
        store.add(mockFn2);

        store.retryAll('test-token');

        expect(mockFn1).toHaveBeenCalledWith('test-token');
        expect(mockFn2).toHaveBeenCalledWith('test-token');
        expect(store.queue).toEqual([]);
    });

    it('should reject all requests with an error and clear the queue', () => {
        const store = useRequestQueueStore();
        const mockFn1 = vi.fn();
        
        store.add(mockFn1);

        const error = new Error('Login cancelled');
        store.rejectAll(error);

        expect(mockFn1).toHaveBeenCalledWith(error);
        expect(store.queue).toEqual([]);
    });

    it('should clear the queue without calling requests', () => {
        const store = useRequestQueueStore();
        const mockFn1 = vi.fn();
        
        store.add(mockFn1);
        store.clear();

        expect(mockFn1).not.toHaveBeenCalled();
        expect(store.queue).toEqual([]);
    });
});
