const cron = require('node-cron');
const asv = require('./domains/ASV');
const logger = require('./utils/logger');
const config = require('./config');

const startScheduler = () => {
    console.log('Scheduler started.');
    
    // Initialize central task manager config
    try {
        const TaskManager = require('./TaskManager');
        TaskManager.init(config);
    } catch (e) {
        console.error('Failed to init dynamic TaskManager:', e.message);
    }
    
    // Run ASV ID generation every hour to pick up newly added missing students
    cron.schedule('0 2 * * *', async () => {
        console.log('Running ASV user ID generation via cron');
        try {
            const { runTask } = require('./utils/taskRunner');
            const added = await runTask('ID_GENERATION', 'CRON');
            console.log(`Generated ${Array.isArray(added) ? added.length : 0} new IDs.`);
        } catch(e) {
            console.error('Cron job generating IDs failed:', e.message);
        }
    });

    // Run clean up job daily at 3:00 AM to remove full diffs older than 14 days
    cron.schedule('0 3 * * *', async () => {
        console.log('Running log cleanup job to retain only summaries for older entries');
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 14); // 14 days retention
            
            const result = await require('./models/Log').updateMany(
                { startTime: { $lt: cutoff }, details: { $exists: true } },
                { $unset: { details: "" } }
            );
            console.log(`Cleaned up full diffs for ${result.modifiedCount} old log entries.`);
        } catch(e) {
            console.error('Failed to run log cleanup job:', e.message);
        }
    });
}

module.exports = { startScheduler };
