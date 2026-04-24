const logger = require('./logger');
const TaskRegistry = require('../tasks/index');
const { runHooks } = require('./hookRunner');

async function runTask(taskName, trigger, params = {}) {
    const task = TaskRegistry[taskName];
    if (!task) throw new Error(`Task ${taskName} not found`);

    const logId = await logger.startTask(taskName, trigger, { params });
    try {
        const details = await task.execute(params);
        if (typeof details === 'object' && details !== null) {
             details.params = params; // preserve params in the details
        }
        const summary = task.summarize(details);
        await logger.endTask(logId, 'SUCCESS', summary, details);
        
        // Execute hooks generically if defined
        await runHooks(taskName, details);
        
        return details;
    } catch (e) {
        const details = { error: e.message, params };
        const summary = task.summarize(details);
        await logger.endTask(logId, 'ERROR', summary, details);
        throw e; // Rethrow to let caller handle if necessary
    }
}
module.exports = { runTask };
