const fs = require('fs');
const path = require('path');

const configDir = path.join(__dirname, '../../config');
const defaultPath = path.join(configDir, 'default.json');
const settingsPath = path.join(configDir, 'settings.json');
const testPath = path.join(configDir, 'test.json');

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

const defaultData = loadJson(defaultPath);
const settingsData = loadJson(settingsPath);
const testData = loadJson(testPath);

let config = deepMerge({}, defaultData);
config = deepMerge(config, settingsData);

// Note: Ensure tests load testData on demand or apply it generally for local dev?
// For synx, including test.json is allowed generally if present. 
config = deepMerge(config, testData);

module.exports = config;
