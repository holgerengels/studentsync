const task = require('../../src/tasks/IdGenerationTask');
const asv = require('../../src/domains/ASV');

jest.mock('../../src/domains/ASV', () => ({
    generateIds: jest.fn()
}));

describe('IdGenerationTask', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('execute calls asv.generateIds', async () => {
        asv.generateIds.mockResolvedValue([{ account: 'id1' }, { account: 'id2' }]);
        const result = await task.execute();
        expect(asv.generateIds).toHaveBeenCalled();
        expect(result).toEqual({
             syncLog: { generatedIds: ['id1', 'id2'] },
             generated: [{ account: 'id1' }, { account: 'id2' }]
        });
    });

    test('summarize formats array output nicely', () => {
        const summary = task.summarize({ generated: ['1', '2', '3'] });
        expect(summary).toBe('<span style="color: #10B981; font-weight: bold;">+3 IDs generiert</span>');
    });

    test('summarize formats empty or error elegantly', () => {
        const emptySummary = task.summarize(null);
        expect(emptySummary).toBe('-');
        
        const errorSummary = task.summarize({ error: 'Network failure' });
        expect(errorSummary).toBe('<span style="color: #EF4444;">Fehler: Network failure</span>');
    });
});
