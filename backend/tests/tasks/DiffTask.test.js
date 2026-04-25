const DiffTask = require('../../src/tasks/DiffTask');
const { getDomain } = require('../../src/domains/registry');

jest.mock('../../src/domains/registry', () => ({
    getDomain: jest.fn()
}));

describe('DiffTask', () => {
    let task;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('execute throws without parameters', async () => {
        getDomain.mockReturnValue(null);
        task = new DiffTask('asv', 'untis');
        await expect(task.execute({})).rejects.toThrow('Domains not found: asv or untis');
    });

    test('execute performs diff with parsed parameters', async () => {
        const mockSource = {
            invalidate: jest.fn(),
            getIdentities: jest.fn().mockResolvedValue([{ userId: 'u1', firstName: 'A', lastName: 'B' }]),
            supportedProperties: ['userId', 'firstName', 'lastName']
        };
        const mockTarget = {
            invalidate: jest.fn(),
            getIdentities: jest.fn().mockResolvedValue([{ userId: 'u1', firstName: 'C', lastName: 'B' }]),
            supportedProperties: ['userId', 'firstName', 'lastName']
        };
        
        getDomain.mockImplementation((name) => {
            if (name === 'asv') return mockSource;
            if (name === 'untis') return mockTarget;
            return null;
        });

        task = new DiffTask('asv', 'untis');
        
        const params = { forceRefresh: true };
        const result = await task.execute(params);
        
        expect(mockSource.invalidate).toHaveBeenCalled();
        expect(mockTarget.invalidate).toHaveBeenCalled();
        expect(result.diff.changed).toHaveLength(1);
    });

    test('format produces correct HTML string format', () => {
        task = new DiffTask('asv', 'untis');
        const details = {
            diff: {
                added: [{}],
                removed: [{}, {}, {}],
                changed: [{}, {}]
            },
            params: { source: 'asv', target: 'webuntis' }
        };
        
        const summary = task.format(details);
        
        expect(summary).toContain('<strong>asv &rarr; webuntis</strong>');
        expect(summary).toContain('<span style="color: #10B981; font-weight: bold;">+1</span>');
        expect(summary).toContain('<span style="color: #F59E0B; font-weight: bold;">~2</span>');
        expect(summary).toContain('<span style="color: #EF4444; font-weight: bold;">-3</span>');
    });

    test('format handles errors', () => {
        task = new DiffTask('asv', 'untis');
        const errorDetails = { error: 'Unknown Domain' };
        expect(task.format(errorDetails)).toBe('<span style="color: #EF4444;">Fehler: Unknown Domain</span>');
    });
    
    test('format handles empty correctly', () => {
        task = new DiffTask('asv', 'untis');
        const details = {
            diff: { added: [], removed: [], changed: [] },
            params: { source: 'asv', target: 'untis' }
        };
        const summary = task.format(details);
        expect(summary).toBe('-');
    });
});
