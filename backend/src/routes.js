const express = require('express');
const router = express.Router();
const { getDomain, getAllDomains } = require('./domains/registry');
const DiffTask = require('./tasks/DiffTask');
const SyncTask = require('./tasks/SyncTask');
const config = require('./config');
const { login, refreshAccessToken, verifyToken } = require('./auth');

router.get('/health', (req, res) => res.json({ status: 'ok' }));

// ------------------------
// Auth APIs
// ------------------------

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
        
        const result = await login(username, password, true);
        if (!result) return res.status(401).json({ error: 'Invalid credentials' });
        
        res.json(result);
    } catch (e) {
        console.error('[Auth Route] Login Error:', e.message);
        res.status(500).json({ error: e.message });
    }
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

// Check if a user matches any of the access rules for a category
function userHasAccess(user, accessRules) {
    if (!accessRules || !Array.isArray(accessRules) || accessRules.length === 0) return true;
    const userGroups = user.groups || [];
    return accessRules.some(rule => {
        if (rule.group) return userGroups.includes(rule.group);
        if (rule.user) return user.username === rule.user;
        return false;
    });
}

// Expose configuration for frontend dynamic rendering (filtered by user access)
router.get('/config/ui', verifyToken, (req, res) => {
    const { isDevMode } = require('./utils/devMode');
    const allCategories = config.categories || [];

    // Filter categories by user access
    const accessibleCategories = allCategories.filter(cat => userHasAccess(req.user, cat.access));
    const accessibleNames = new Set(accessibleCategories.map(c => c.name));

    res.json({
        categories: accessibleCategories.map(c => ({ name: c.name, label: c.label })),
        domains: (config.domains || []).filter(d => accessibleNames.has(d.category)),
        diffs: (config.diffs || []).filter(d => accessibleNames.has(d.category)),
        tasks: config.tasks || [],
        devMode: isDevMode()
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
        console.error(`[Route] GET /identities/${req.params.domainName} failed:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// Generic Task Execution Endpoint — delegates to centralized taskRunner for consistent logging
router.post('/execute/:taskName', verifyToken, async (req, res) => {
    try {
        const { runTask } = require('./utils/taskRunner');
        const parameters = req.body || {};
        const report = await runTask(req.params.taskName, 'MANUAL', parameters);

        const tasks = require('./tasks/index');
        const task = tasks[req.params.taskName];
        let htmlSnippet = '';
        if (task) {
            htmlSnippet = typeof task.summarize === 'function' ? task.summarize(report) : task.format(report);
        }

        res.json({ status: 'success', report, html: htmlSnippet });
    } catch (e) {
        console.error(`[Route] POST /execute/${req.params.taskName} failed:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// Calculate Diff
router.post('/diff/:source/:target', verifyToken, async (req, res) => {
    try {
        const { source, target } = req.params;
        const task = new DiffTask(source, target);
        const report = await task.execute({ forceRefresh: req.query.refresh === 'true' });
        
        // Read-only diff calculation — no logging needed
        res.json({ status: 'success', summary: { 
            added: report.diff.added.length, 
            removed: report.diff.removed.length, 
            changed: report.diff.changed.length,
            unchanged: report.unchangedCount
        }, report });
    } catch(e) {
        console.error(`[Route] POST /diff/${req.params.source}/${req.params.target} failed:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// Execute Sync — uses centralized logger for consistent log entries
router.post('/sync/:source/:target', verifyToken, async (req, res) => {
    try {
        const { source, target } = req.params;
        const task = new SyncTask(source, target);
        const logger = require('./utils/logger');

        const logId = await logger.startTask(task.name, 'MANUAL');
        const report = await task.execute({ forceRefresh: req.query.refresh === 'true' });
        const htmlSnippet = task.format(report);

        const status = report.syncLog?.errors?.length ? 'ERROR' : 'SUCCESS';
        await logger.endTask(logId, status, htmlSnippet, report.syncLog || report);

        res.json({ status: 'success', syncLog: report.syncLog, devMode: report.devMode, html: htmlSnippet });
    } catch(e) {
        console.error(`[Route] POST /sync/${req.params.source}/${req.params.target} failed:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// Logs API
router.get('/logs', verifyToken, async (req, res) => {
    try {
        const Log = require('./models/Log');
        const limit = parseInt(req.query.limit) || 50;
        const logs = await Log.find().sort({ startTime: -1 }).limit(limit);
        res.json(logs);
    } catch (e) {
        console.error('[Route] GET /logs failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

