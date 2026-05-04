describe('devMode utility', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.resetModules();
    });

    function loadDevMode(configOverride = {}) {
        jest.resetModules();
        jest.doMock('../../src/config', () => configOverride);
        return require('../../src/utils/devMode');
    }

    describe('isDevMode()', () => {
        it('should return true by default (NODE_ENV is not production)', () => {
            process.env.NODE_ENV = 'development';
            const { isDevMode } = loadDevMode({});
            expect(isDevMode()).toBe(true);
        });

        it('should return false when NODE_ENV is production', () => {
            process.env.NODE_ENV = 'production';
            const { isDevMode } = loadDevMode({});
            expect(isDevMode()).toBe(false);
        });

        it('should respect config.settings.devMode = false override', () => {
            process.env.NODE_ENV = 'development';
            const { isDevMode } = loadDevMode({ settings: { devMode: false } });
            expect(isDevMode()).toBe(false);
        });

        it('should respect config.settings.devMode = true override even in production', () => {
            process.env.NODE_ENV = 'production';
            const { isDevMode } = loadDevMode({ settings: { devMode: true } });
            expect(isDevMode()).toBe(true);
        });

        it('should handle missing settings gracefully', () => {
            process.env.NODE_ENV = 'test';
            const { isDevMode } = loadDevMode({});
            expect(isDevMode()).toBe(true); // not production → dev mode
        });
    });

    describe('limitInDevMode()', () => {
        it('should limit array to 1 item in devMode', () => {
            process.env.NODE_ENV = 'development';
            const { limitInDevMode } = loadDevMode({});
            const result = limitInDevMode(['a', 'b', 'c', 'd']);
            expect(result.items).toEqual(['a']);
            expect(result.limited).toBe(true);
            expect(result.totalCount).toBe(4);
        });

        it('should not limit single-item array in devMode', () => {
            process.env.NODE_ENV = 'development';
            const { limitInDevMode } = loadDevMode({});
            const result = limitInDevMode(['only']);
            expect(result.items).toEqual(['only']);
            expect(result.limited).toBe(false);
            expect(result.totalCount).toBe(1);
        });

        it('should not limit in production mode', () => {
            process.env.NODE_ENV = 'production';
            const { limitInDevMode } = loadDevMode({});
            const result = limitInDevMode(['a', 'b', 'c']);
            expect(result.items).toEqual(['a', 'b', 'c']);
            expect(result.limited).toBe(false);
            expect(result.totalCount).toBe(3);
        });

        it('should handle empty array', () => {
            process.env.NODE_ENV = 'development';
            const { limitInDevMode } = loadDevMode({});
            const result = limitInDevMode([]);
            expect(result.items).toEqual([]);
            expect(result.limited).toBe(false);
            expect(result.totalCount).toBe(0);
        });
    });

    describe('devModeSuffix()', () => {
        it('should return badge HTML when devMode is true', () => {
            const { devModeSuffix } = loadDevMode({});
            const suffix = devModeSuffix(true);
            expect(suffix).toContain('[DEV MODE LIMIT]');
        });

        it('should return empty string when devMode is false', () => {
            const { devModeSuffix } = loadDevMode({});
            expect(devModeSuffix(false)).toBe('');
        });
    });
});
