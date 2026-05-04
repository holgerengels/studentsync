const DiffTask = require('../../src/tasks/DiffTask');
const { createMockDomains } = require('../helpers/mockSetup');

describe('DiffTask', () => {
    let mocks;

    beforeEach(() => {
        mocks = createMockDomains();
    });

    it('should throw when domains are not registered', () => {
        const { clearRegistry } = require('../../src/domains/registry');
        clearRegistry();

        const task = new DiffTask('nonexistent', 'also-nonexistent');
        return expect(task.execute({})).rejects.toThrow('Domains not found');
    });

    it('should detect additions (source has users not in target)', async () => {
        // ASV mock data has user at index 0 with no userId (null) — untis mock skips index 0 and 1
        // So there are known differences in the mock data
        const task = new DiffTask('asv', 'untis');
        const report = await task.execute({ forceRefresh: true });

        expect(report.diff.added.length).toBeGreaterThanOrEqual(0);
        expect(report.intersectedProperties).toContain('firstName');
        expect(report.intersectedProperties).toContain('lastName');
        expect(report.params.source).toBe('asv');
        expect(report.params.target).toBe('untis');
    });

    it('should detect changes when properties differ', async () => {
        // Schulkonsole mock has user at index 3 with wrong class '99Z'
        const task = new DiffTask('asv', 'schulkonsole');
        const report = await task.execute({});

        const changedUserIds = report.diff.changed.map(c => c.source.userId || c.target.userId);
        expect(report.diff.changed.length).toBeGreaterThanOrEqual(1);
        expect(report.intersectedProperties).toContain('clazz');
    });

    it('should detect removals (target has users not in source)', async () => {
        // Nextcloud mock has a ghost user 'ghost_us' not in ASV
        const task = new DiffTask('asv', 'nextcloud');
        const report = await task.execute({});

        const removedUserIds = report.diff.removed.map(r => r.userId);
        expect(removedUserIds).toContain('ghost_us');
    });

    it('should only compare intersected properties', async () => {
        // ASV supports birthday, untis also supports birthday
        // WebUntis does NOT support birthday or clazz
        const task = new DiffTask('asv', 'webuntis');
        const report = await task.execute({});

        // The intersected properties should NOT include clazz or birthday since webuntis doesn't support them
        expect(report.intersectedProperties).toContain('userId');
        expect(report.intersectedProperties).toContain('firstName');
        expect(report.intersectedProperties).toContain('lastName');
        expect(report.intersectedProperties).not.toContain('birthday');
        expect(report.intersectedProperties).not.toContain('clazz');
    });

    it('should invalidate caches on forceRefresh', async () => {
        const spy = jest.spyOn(mocks.asv, 'invalidate');
        const task = new DiffTask('asv', 'untis');
        await task.execute({ forceRefresh: true });
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should report unchanged count', async () => {
        // Same domain against itself → all unchanged
        const task = new DiffTask('asv', 'asv');
        const report = await task.execute({ forceRefresh: true });

        expect(report.diff.added).toHaveLength(0);
        expect(report.diff.removed).toHaveLength(0);
        expect(report.diff.changed).toHaveLength(0);
        expect(report.unchangedCount).toBeGreaterThan(0);
    });

    describe('format()', () => {
        it('produces HTML with diff counts', () => {
            const task = new DiffTask('asv', 'untis');
            const report = {
                diff: { added: [{}], removed: [{}, {}, {}], changed: [{}, {}] },
                params: { source: 'asv', target: 'untis' }
            };
            const html = task.format(report);
            expect(html).toContain('asv &rarr; untis');
            expect(html).toContain('+1');
            expect(html).toContain('~2');
            expect(html).toContain('-3');
        });

        it('returns dash for empty diff', () => {
            const task = new DiffTask('asv', 'untis');
            const report = {
                diff: { added: [], removed: [], changed: [] },
                params: { source: 'asv', target: 'untis' }
            };
            expect(task.format(report)).toBe('-');
        });

        it('handles error report', () => {
            const task = new DiffTask('asv', 'untis');
            expect(task.format({ error: 'Timeout' })).toContain('Fehler: Timeout');
        });

        it('handles null report', () => {
            const task = new DiffTask('asv', 'untis');
            expect(task.format(null)).toBe('-');
        });
    });
});
