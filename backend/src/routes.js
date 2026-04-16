const express = require('express');
const router = express.Router();
const { getDomain, getAllDomains } = require('./domains/registry');
const DiffTask = require('./tasks/DiffTask');
const SyncTask = require('./tasks/SyncTask');
const Log = require('./models/Log'); // assuming Log exists
const config = require('./config');
const { login, refreshAccessToken, verifyToken } = require('./auth');

router.get('/health', (req, res) => res.json({ status: 'ok' }));

// ------------------------
// Auth APIs
// ------------------------

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
    
    const result = await login(username, password, true);
    if (!result) return res.status(401).json({ error: 'Invalid credentials' });
    
    res.json(result);
});

router.post('/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'No refresh token' });

    const result = refreshAccessToken(refreshToken);
    if (!result) return res.status(401).json({ error: 'Refresh token invalid or expired' });
    
    res.json(result);
});

// ------------------------
// Dynamic Environment APIs
// ------------------------

// Expose configuration for frontend dynamic rendering
router.get('/config/ui', (req, res) => {
    res.json({
        domains: config.domains || [],
        diffs: config.diffs || [],
        tasks: config.tasks || []
    });
});

// Identities API for any registered domain
router.get('/identities/:domainName', verifyToken, async (req, res) => {
    try {
        const domain = getDomain(req.params.domainName);
        if (!domain) {
            return res.status(404).json({ error: `Domain ${req.params.domainName} not found or not registered` });
        }
        if (req.query.refresh === 'true') {
            domain.invalidate();
        }
        const identities = await domain.getIdentities();
        res.json(identities);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Generic Task Execution Endpoint
router.post('/execute/:taskName', verifyToken, async (req, res) => {
    try {
        const tasks = require('./tasks/index');
        const task = tasks[req.params.taskName];
        if (!task) return res.status(404).json({ error: `Task ${req.params.taskName} not found` });
        
        let report;
        if (typeof task.execute === 'function') {
            const parameters = req.body || {};
            report = await task.execute(parameters);
        } else {
            return res.status(501).json({ error: `Task ${req.params.taskName} has no execute method` });
        }
        let htmlSnippet = '';
        if (typeof task.summarize === 'function') {
            htmlSnippet = task.summarize(report);
        } else if (typeof task.format === 'function') {
            htmlSnippet = task.format(report);
        }
        
        // Ensure all modifying tasks invoked manually store a log trail
        const logEntry = new Log({
            task: req.params.taskName,
            trigger: 'MANUAL',
            status: (report && report.syncLog && report.syncLog.errors && report.syncLog.errors.length) ? 'ERROR' : 'SUCCESS',
            details: typeof report === 'object' ? (report.syncLog || report) : { result: String(report) },
            summaryHtml: htmlSnippet,
            startTime: new Date(),
            endTime: new Date(),
            durationMs: 0 // Will fix when we wrap it completely, for now keep simple
        });
        await logEntry.save().catch(e => console.error("Logging error during execute:", e.message));
        
        res.json({ status: 'success', report, html: htmlSnippet });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Calculate Diff
router.post('/diff/:source/:target', verifyToken, async (req, res) => {
    try {
        const { source, target } = req.params;
        const task = new DiffTask(source, target);
        const report = await task.execute({ forceRefresh: req.query.refresh === 'true' });
        
        // In real execution, we'd log this, but this is explicit diff calculation API
        res.json({ status: 'success', summary: { 
            added: report.diff.added.length, 
            removed: report.diff.removed.length, 
            changed: report.diff.changed.length,
            unchanged: report.unchangedCount
        }, report });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Execute Sync
router.post('/sync/:source/:target', verifyToken, async (req, res) => {
    try {
        const { source, target } = req.params;
        const task = new SyncTask(source, target);
        const report = await task.execute({ forceRefresh: req.query.refresh === 'true' });
        
        // Simplified log saving process
        const htmlSnippet = task.format(report);
        const logEntry = new Log({
            task: task.name,
            trigger: 'MANUAL',
            status: report.syncLog?.errors?.length ? 'ERROR' : 'SUCCESS',
            details: typeof report === 'object' ? (report.syncLog || report) : { result: String(report) },
            summaryHtml: htmlSnippet,
            startTime: new Date(),
            endTime: new Date(),
            durationMs: 0
        });
        await logEntry.save().catch(e => console.error("Logging error during sync:", e.message));

        res.json({ status: 'success', syncLog: report.syncLog, devMode: report.devMode, html: htmlSnippet });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Logs API
router.get('/logs', verifyToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = await Log.find().sort({ startTime: -1 }).limit(limit);
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
