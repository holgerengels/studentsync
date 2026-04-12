class DummyTask {
    async execute(params) {
        console.log(`[DummyTask] Executing with params:`, params);
        
        // Simulate some async processing
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
            status: 'success',
            message: 'Dummy task executed successfully',
            timestamp: new Date().toISOString()
        };
    }

    summarize(details) {
        if (!details) return '-';
        if (details.error) {
            return `<span style="color: #EF4444;">Fehler: ${details.error}</span>`;
        }
        return `<span>Erfolgreich ausgeführt: ${details.message || 'ohne Nachricht'}</span>`;
    }
}

module.exports = DummyTask;
