const Domain = require('../../src/domains/Domain');

class TestDomain extends Domain {
    constructor(name = 'test', data = []) {
        super(name);
        this._data = data;
        this.readCount = 0;
    }
    get cacheTTL() { return 100; } // 100ms for fast TTL testing
    async readIdentities() {
        this.readCount++;
        return this._data;
    }
}

describe('Domain Base Class', () => {
    let domain;

    beforeEach(() => {
        domain = new TestDomain('test', [
            { userId: 'u1', firstName: 'A', lastName: 'B' },
            { userId: 'u2', firstName: 'C', lastName: 'D' }
        ]);
    });

    describe('caching', () => {
        it('should cache identities after first fetch', async () => {
            await domain.getIdentities();
            await domain.getIdentities();
            await domain.getIdentities();
            expect(domain.readCount).toBe(1);
        });

        it('should re-fetch after invalidation', async () => {
            await domain.getIdentities();
            domain.invalidate();
            await domain.getIdentities();
            expect(domain.readCount).toBe(2);
        });

        it('should return correct data', async () => {
            const data = await domain.getIdentities();
            expect(data).toHaveLength(2);
            expect(data[0].userId).toBe('u1');
        });

        it('should handle concurrent calls without duplicate fetches', async () => {
            const [r1, r2, r3] = await Promise.all([
                domain.getIdentities(),
                domain.getIdentities(),
                domain.getIdentities()
            ]);
            expect(domain.readCount).toBe(1);
            expect(r1).toBe(r2);
            expect(r2).toBe(r3);
        });
    });

    describe('TTL auto-invalidation', () => {
        it('should auto-invalidate after cacheTTL expires', async () => {
            await domain.getIdentities();
            expect(domain.readCount).toBe(1);

            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, 150));

            await domain.getIdentities();
            expect(domain.readCount).toBe(2);
        });

        it('should not auto-invalidate before TTL expires', async () => {
            await domain.getIdentities();
            await new Promise(resolve => setTimeout(resolve, 10));
            await domain.getIdentities();
            expect(domain.readCount).toBe(1);
        });

        it('should not auto-invalidate when cacheTTL is 0/undefined', async () => {
            class NoCacheTTLDomain extends Domain {
                async readIdentities() { return []; }
            }
            const d = new NoCacheTTLDomain('no-ttl');
            await d.getIdentities();
            await new Promise(resolve => setTimeout(resolve, 50));
            await d.getIdentities();
            // cacheTTL is undefined → no auto-invalidation → still cached
        });
    });

    describe('lock/unlock', () => {
        it('should defer invalidation while locked', async () => {
            await domain.getIdentities();
            domain.lock();
            domain.invalidate();
            // Cache should still be intact
            const data = await domain.getIdentities();
            expect(domain.readCount).toBe(1);
        });

        it('should process deferred invalidation on unlock', async () => {
            await domain.getIdentities();
            domain.lock();
            domain.invalidate();
            domain.unlock();
            // Now the cache should be invalidated
            await domain.getIdentities();
            expect(domain.readCount).toBe(2);
        });

        it('should not invalidate on unlock if no deferred invalidation', async () => {
            await domain.getIdentities();
            domain.lock();
            domain.unlock();
            await domain.getIdentities();
            expect(domain.readCount).toBe(1);
        });
    });

    describe('error handling & connection robustness', () => {
        it('should throw on backend failure, never return empty array', async () => {
            class FailDomain extends Domain {
                async readIdentities() {
                    throw new Error('Connection refused');
                }
            }
            const d = new FailDomain('fail');
            await expect(d.getIdentities()).rejects.toThrow('Connection refused');
        });

        it('should retry after a failed fetch (single failure)', async () => {
            let callCount = 0;
            class FailOnceDomain extends Domain {
                async readIdentities() {
                    callCount++;
                    if (callCount === 1) throw new Error('Network error');
                    return [{ userId: 'ok' }];
                }
            }
            const d = new FailOnceDomain('fail-once');
            await expect(d.getIdentities()).rejects.toThrow('Network error');
            // Second call should retry and succeed
            const data = await d.getIdentities();
            expect(data).toHaveLength(1);
            expect(callCount).toBe(2);
        });

        it('should recover after multiple consecutive failures', async () => {
            let callCount = 0;
            class IntermittentDomain extends Domain {
                async readIdentities() {
                    callCount++;
                    if (callCount <= 3) throw new Error(`Failure #${callCount}`);
                    return [{ userId: 'recovered' }];
                }
            }
            const d = new IntermittentDomain('intermittent');

            // Fails 3 times
            await expect(d.getIdentities()).rejects.toThrow('Failure #1');
            await expect(d.getIdentities()).rejects.toThrow('Failure #2');
            await expect(d.getIdentities()).rejects.toThrow('Failure #3');

            // 4th call succeeds — system reconnected
            const data = await d.getIdentities();
            expect(data).toHaveLength(1);
            expect(data[0].userId).toBe('recovered');
            expect(callCount).toBe(4);
        });

        it('should not cache error state — each failure allows a fresh retry', async () => {
            let callCount = 0;
            class AlwaysFailDomain extends Domain {
                async readIdentities() {
                    callCount++;
                    throw new Error('Still down');
                }
            }
            const d = new AlwaysFailDomain('always-fail');

            await expect(d.getIdentities()).rejects.toThrow('Still down');
            await expect(d.getIdentities()).rejects.toThrow('Still down');
            await expect(d.getIdentities()).rejects.toThrow('Still down');

            // Each call was a genuine retry, not a cached error
            expect(callCount).toBe(3);
        });

        it('should handle concurrent calls during failure without caching the error', async () => {
            let callCount = 0;
            class SlowFailDomain extends Domain {
                async readIdentities() {
                    callCount++;
                    await new Promise(r => setTimeout(r, 50));
                    throw new Error('Timeout');
                }
            }
            const d = new SlowFailDomain('slow-fail');

            // Two concurrent calls should share the same promise
            const [r1, r2] = await Promise.allSettled([
                d.getIdentities(),
                d.getIdentities()
            ]);

            expect(r1.status).toBe('rejected');
            expect(r2.status).toBe('rejected');
            expect(callCount).toBe(1); // shared the same failed promise

            // But next call should retry fresh
            callCount = 0;
            await expect(d.getIdentities()).rejects.toThrow('Timeout');
            expect(callCount).toBe(1);
        });

        it('should preserve cached data when invalidate is called during error recovery', async () => {
            let callCount = 0;
            class RecoveryDomain extends Domain {
                async readIdentities() {
                    callCount++;
                    return [{ userId: `batch-${callCount}` }];
                }
            }
            const d = new RecoveryDomain('recovery');

            // First successful fetch
            const data1 = await d.getIdentities();
            expect(data1[0].userId).toBe('batch-1');

            // Invalidate and fetch again
            d.invalidate();
            const data2 = await d.getIdentities();
            expect(data2[0].userId).toBe('batch-2');
            expect(callCount).toBe(2);
        });
    });

    describe('supportedProperties', () => {
        it('should return default properties', () => {
            expect(domain.supportedProperties).toEqual(['userId', 'firstName', 'lastName']);
        });
    });
});
