const fs = require('fs');
const path = require('path');

const configDir = path.join(__dirname, '../../config');

const RESERVED_FILES = new Set(['settings.json', 'config.json', 'test.json']);

function loadJson(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error(`Failed to load ${filePath}:`, e.message);
    }
    return {};
}

// Deep merge utility mapping array objects by 'name' key if present
function deepMerge(target, source) {
    const isObject = obj => obj && typeof obj === 'object' && !Array.isArray(obj);
    
    if (!isObject(target) || !isObject(source)) {
        return source;
    }
    
    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            // merge array logic primarily for 'domains' and 'diffs' configuration
            const mergedArray = [...targetValue];
            sourceValue.forEach(sourceItem => {
                const existingIndex = mergedArray.findIndex(
                    tItem => isObject(sourceItem) && isObject(tItem) && tItem.name && tItem.name === sourceItem.name
                );
                
                if (existingIndex > -1) {
                    mergedArray[existingIndex] = deepMerge(mergedArray[existingIndex], sourceItem);
                } else {
                    mergedArray.push(sourceItem);
                }
            });
            target[key] = mergedArray;
        } else if (isObject(targetValue) && isObject(sourceValue)) {
            target[key] = deepMerge(Object.assign({}, targetValue), sourceValue);
        } else {
            target[key] = sourceValue;
        }
    });

    return target;
}

// 1. Load settings.json — endpoint credentials & server infrastructure
const settingsData = loadJson(path.join(configDir, 'settings.json'));

// 2. Load config.json — runtime overrides (devMode, Schuljahr, mappings, etc.)
const configData = loadJson(path.join(configDir, 'config.json'));

// 3. Merge settings + config overrides
let config = deepMerge({}, settingsData);
config = deepMerge(config, configData);

// 4. Dynamically discover category files (all *.json except reserved files)
const categoryFiles = fs.readdirSync(configDir)
    .filter(f => f.endsWith('.json') && !RESERVED_FILES.has(f))
    .sort();

config.domains = [];
config.diffs = [];
config.tasks = [];

for (const file of categoryFiles) {
    const categoryData = loadJson(path.join(configDir, file));
    if (categoryData.domains) config.domains.push(...categoryData.domains);
    if (categoryData.diffs) config.diffs.push(...categoryData.diffs);
    if (categoryData.tasks) config.tasks.push(...categoryData.tasks);
    console.log(`[Config] Loaded category: ${file}`);
}

// 5. Apply test.json overlay (deep merge, can override individual entries)
const testData = loadJson(path.join(configDir, 'test.json'));
config = deepMerge(config, testData);

module.exports = config;
