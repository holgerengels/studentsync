const Identity = require('../models/Identity');

const asv = require('./ASV');
const untis = require('./Untis');
const schulkonsole = require('./Schulkonsole');
const webuntis = require('./WebUntis');

const BaseDomain = require('./BaseDomain');

const domains = {
    asv,
    untis,
    schulkonsole,
    webuntis,
    relution: new BaseDomain('relution')
};

async function diffDomains(source, target, forceRefresh = false) {
    if (!domains[source]) throw new Error(`Domain ${source} not found`);
    if (!domains[target]) throw new Error(`Domain ${target} not found`);

    if (forceRefresh) {
        domains[source].invalidateCache();
        domains[target].invalidateCache();
    }

    // Collect specific fields for basic diffing
    const sourceRecords = await domains[source].getIdentities();
    const targetRecords = await domains[target].getIdentities();

    // Convert to dictionary by account name
    const sourceDict = {};
    sourceRecords.forEach(r => sourceDict[r.account] = r);

    const targetDict = {};
    targetRecords.forEach(r => targetDict[r.account] = r);

    const added = [];
    const removed = [];
    const changed = [];

    // Diff logic based on common capabilities
    const sourceProps = domains[source].supportedProperties || ['firstName', 'lastName', 'clazz'];
    const targetProps = domains[target].supportedProperties || ['firstName', 'lastName', 'clazz'];
    const intersectedProperties = sourceProps.filter(p => targetProps.includes(p));

    // Diff logic
    for (const key in sourceDict) {
        if (!targetDict[key]) {
            added.push(sourceDict[key]);
        } else {
            // Compare ONLY intersected properties
            let isDifferent = false;
            for (const prop of intersectedProperties) {
                if (sourceDict[key][prop] !== targetDict[key][prop]) {
                    isDifferent = true;
                    break;
                }
            }
            if (isDifferent) {
                changed.push({
                    source: sourceDict[key],
                    target: targetDict[key]
                });
            }
        }
    }

    for (const key in targetDict) {
        if (!sourceDict[key]) {
            removed.push(targetDict[key]);
        }
    }

    return { added, removed, changed, intersectedProperties };
}

module.exports = {
    domains,
    diffDomains
};
