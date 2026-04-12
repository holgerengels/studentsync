const DiffTask = require('../../src/tasks/DiffTask');
const { diffDomains } = require('../../src/domains/index');

jest.mock('../../src/domains/index', () => {
    return {
        diffDomains: jest.fn()
    };
});

describe('DiffTask', () => {
    let task;

    beforeEach(() => {
        task = new DiffTask();
        jest.clearAllMocks();
    });

    test('execute throws without parameters', async () => {
        await expect(task.execute({})).rejects.toThrow('Missing source or target in params');
    });

    test('execute calls diffDomains with parsed parameters', async () => {
        diffDomains.mockResolvedValue({ added: [], removed: [], changed: [] });
        
        const params = { source: 'asv', target: 'untis', forceRefresh: true };
        const result = await task.execute(params);
        
        expect(diffDomains).toHaveBeenCalledWith('asv', 'untis', true);
        expect(result).toEqual({ added: [], removed: [], changed: [] }); // DiffTask doesn't append params!
    });

    test('summarize produces correct HTML string format', () => {
        const details = {
            added: [{}],
            removed: [{}, {}, {}],
            changed: [{}, {}],
            params: { source: 'asv', target: 'webuntis' }
        };
        
        const summary = task.summarize(details);
        
        expect(summary).toContain('<strong>asv &rarr; webuntis</strong>');
        expect(summary).toContain('<span style="color: #10B981; font-weight: bold;">+1</span>');
        expect(summary).toContain('<span style="color: #F59E0B; font-weight: bold;">~2</span>');
        expect(summary).toContain('<span style="color: #EF4444; font-weight: bold;">-3</span>');
    });

    test('summarize handles errors', () => {
        const errorDetails = { error: 'Unknown Domain' };
        expect(task.summarize(errorDetails)).toBe('<span style="color: #EF4444;">Fehler: Unknown Domain</span>');
    });
    
    test('summarize handles empty correctly', () => {
        const details = {
            added: [], removed: [], changed: [],
            params: { source: 'asv', target: 'untis' }
        };
        const summary = task.summarize(details);
        expect(summary).toContain('<strong>asv &rarr; untis</strong>');
        expect(summary).toContain('+0');
        expect(summary).toContain('~0');
        expect(summary).toContain('-0');
    });
});
