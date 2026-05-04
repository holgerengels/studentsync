const Log = require('../models/Log');

class Logger {
    constructor() {
        // Keeps track of active logs by their _id to allow updates
    }

    /**
     * Start a new log entry.
     * @returns {string} The ID of the newly created log entry (to pass to endTask).
     */
    async startTask(task, trigger, details = {}) {
        try {
            const logEntry = new Log({
                task,
                trigger,
                status: 'IN_PROGRESS',
                details
            });
            await logEntry.save();
            return logEntry._id;
        } catch (e) {
            console.error('Failed to start task log in DB:', e.message);
            return null;
        }
    }

    /**
     * Mark a log entry as complete with changes and final status.
     */
    async endTask(id, status, summaryHtml = '', details = null) {
        if (!id) return;
        try {
            const logEntry = await Log.findById(id);
            if (!logEntry) return;

            logEntry.status = status;
            logEntry.endTime = new Date();
            logEntry.durationMs = logEntry.endTime - logEntry.startTime;

            if (summaryHtml) {
                logEntry.summaryHtml = summaryHtml;
            }

            if (details) {
                logEntry.details = details;
                logEntry.markModified('details');
            }

            await logEntry.save();
        } catch (e) {
            console.error('Failed to end task log in DB:', e.message);
        }
    }
    
    /**
     * One-shot logic for quick fail/success logs
     */
    async logDirect(task, trigger, status, summaryHtml, details) {
        try {
            const start = new Date();
            const logEntry = new Log({
                task, trigger, status, summaryHtml, details,
                startTime: start,
                endTime: start,
                durationMs: 0
            });
            await logEntry.save();
        } catch(e) {
            console.error('Failed to log direct in DB', e.message);
        }
    }
}

module.exports = new Logger();
