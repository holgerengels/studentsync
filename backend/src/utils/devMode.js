/**
 * Central dev mode utility.
 * 
 * DevMode is ON by default in development (NODE_ENV !== 'production').
 * It can be overridden in config/default.json via settings.devMode: true|false.
 * 
 * When devMode is active, all write operations are limited to 1 change maximum
 * to prevent accidental mass-mutations against real backends during development.
 */
const config = require('../config');

function isDevMode() {
    // Default: devMode is ON unless NODE_ENV is 'production'
    let devMode = process.env.NODE_ENV !== 'production';

    // Config override takes precedence
    if (config && config.settings && config.settings.devMode !== undefined) {
        devMode = !!config.settings.devMode;
    }

    return devMode;
}

/**
 * Limits an array of pending write operations to at most 1 entry in devMode.
 * Returns { items, limited, totalCount } where:
 *   - items: the (possibly truncated) array to process
 *   - limited: true if items were truncated
 *   - totalCount: the original array length before truncation
 */
function limitInDevMode(items) {
    const devMode = isDevMode();
    if (devMode && items.length > 1) {
        return { items: items.slice(0, 1), limited: true, totalCount: items.length };
    }
    return { items, limited: false, totalCount: items.length };
}

/**
 * Appends the [DEV MODE LIMIT] badge to HTML output when devMode was active.
 */
function devModeSuffix(isActive) {
    if (!isActive) return '';
    return ' <span style="font-size: smaller; opacity: 0.7;">[DEV MODE LIMIT]</span>';
}

module.exports = { isDevMode, limitInDevMode, devModeSuffix };
