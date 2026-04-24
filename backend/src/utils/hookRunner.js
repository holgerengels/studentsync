const vm = require('vm');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const CONFIG_DIR = path.join(__dirname, '../../../config');

async function runHooks(taskName, details) {
    if (!config.hooks || !Array.isArray(config.hooks)) return;

    // Filter hooks matching the exact taskName (case-insensitive for safety, but usually exact)
    const applicableHooks = config.hooks.filter(h => h.task === taskName || h.task === taskName.toLowerCase() || h.task === taskName.toUpperCase());
    
    if (applicableHooks.length === 0) return;

    console.log(`[HookRunner] Found ${applicableHooks.length} hook(s) for task ${taskName}`);

    for (const hook of applicableHooks) {
        try {
            const scriptPath = path.join(CONFIG_DIR, `${hook.script}.js`);
            if (!fs.existsSync(scriptPath)) {
                console.warn(`[HookRunner] Script file not found: ${scriptPath}`);
                continue;
            }

            const scriptContent = fs.readFileSync(scriptPath, 'utf8');

            const sandbox = {
                require: require,
                console: console,
                process: process,
                path: path,
                fs: fs,
                module: {},
                exports: {},
                __dirname: CONFIG_DIR,
                setTimeout: setTimeout,
                setInterval: setInterval,
                clearTimeout: clearTimeout,
                clearInterval: clearInterval
            };
            sandbox.module.exports = sandbox.exports;

            vm.createContext(sandbox);
            vm.runInContext(scriptContent, sandbox);

            const scriptExports = sandbox.module.exports;

            if (typeof scriptExports[hook.condition] === 'function') {
                const conditionMet = await scriptExports[hook.condition](details);
                if (conditionMet) {
                    if (typeof scriptExports[hook.action] === 'function') {
                        console.log(`[HookRunner] Condition met for hook script ${hook.script}. Executing action ${hook.action}...`);
                        await scriptExports[hook.action](details);
                    } else {
                        console.warn(`[HookRunner] Condition met, but action function ${hook.action} not found in ${hook.script}.js`);
                    }
                } else {
                    console.log(`[HookRunner] Condition not met for hook script ${hook.script}`);
                }
            } else {
                 console.warn(`[HookRunner] Condition function ${hook.condition} not found in ${hook.script}.js`);
            }
        } catch (err) {
            console.error(`[HookRunner] Error evaluating hook ${hook.script} for task ${taskName}:`, err);
        }
    }
}

module.exports = { runHooks };
