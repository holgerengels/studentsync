const cron = require('node-cron');
const tasks = require('./tasks');

class TaskManager {
    constructor() {
        this.scheduledJobs = {};
    }

    /**
     * Initializes the TaskManager with the given configuration object.
     * Iterates over config.tasks and schedules any task that has a 'schedule' property.
     * Example: "schedule": "0 2 * * *"
     */
    init(config) {
        console.log('[TaskManager] Initializing from configuration...');
        const tasksConfig = config.tasks;
        if (!tasksConfig || !Array.isArray(tasksConfig)) {
            console.log('[TaskManager] No "tasks" array found in config. Skipping automatic scheduling.');
            return;
        }

        let scheduledCount = 0;
        tasksConfig.forEach(taskDef => {
            if (!taskDef.schedule) return;

            const taskName = taskDef.name;
            const rawCron = taskDef.schedule;

            // Convert older "HH:MM" patterns gracefully to "MM HH * * *" just in case
            let cronStr = rawCron;
            if (/^\d{1,2}:\d{2}$/.test(rawCron)) {
                const parts = rawCron.split(':');
                cronStr = `${parts[1]} ${parts[0]} * * *`;
                console.log(`[TaskManager] Converted legacy time '${rawCron}' to valid cron string: '${cronStr}' for task '${taskName}'`);
            }

            if (!cron.validate(cronStr)) {
                console.warn(`[TaskManager] Invalid cron string '${rawCron}' for task '${taskName}'. Ignoring.`);
                return;
            }

            // Check if the task is defined in our registry
            const taskImpl = tasks[taskName.toUpperCase()] || tasks[taskName];
            if (!taskImpl) {
                console.warn(`[TaskManager] Task implementation for '${taskName}' not found in registry. Schedule ignored.`);
                return;
            }

            // Schedule the job
            this.scheduledJobs[taskName] = cron.schedule(cronStr, async () => {
                console.log(`[TaskManager] Running scheduled task: ${taskName} at ${new Date().toISOString()}`);
                try {
                    await this.executeTask(taskName, 'CRON');
                } catch(e) {
                    console.error(`[TaskManager] Automated schedule for ${taskName} failed:`, e.message);
                }
            });

            console.log(`[TaskManager] Scheduled '${taskName}' with cron '${cronStr}'`);
            scheduledCount++;
        });

        if (scheduledCount === 0) {
            console.log('[TaskManager] No tasks with a "schedule" property found in config. Skipping automatic scheduling.');
        }
    }

    /**
     * Executes the task synchronously by its configured name.
     */
    async executeTask(taskName, triggerType = 'MANUAL', options = {}) {
        const { runTask } = require('./utils/taskRunner');
        
        // Upper-case standard syncs/diffs vs generic tasks.
        // We look up the exact task name in the tasks dictionary to verify existence.
        const taskKey = tasks[taskName] ? taskName : taskName.toUpperCase();
        if (!tasks[taskKey]) {
            throw new Error(`Task '${taskName}' is not recognized or not implemented.`);
        }
        
        console.log(`[TaskManager] Triggering execution mapping for '${taskName}' via Runner...`);
        // Uses the centralized logger/taskRunner ensuring consistent Mongoose log output
        return await runTask(taskKey, triggerType, options);
    }
}

// Export as a singleton
module.exports = new TaskManager();
