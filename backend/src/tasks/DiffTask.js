const Task = require('./Task');
const Diff = require('../utils/Diff');
const { getDomain } = require('../domains/registry');

class DiffTask extends Task {
    constructor(sourceName, targetName) {
        super(`${sourceName}-${targetName}-diff`);
        this.sourceName = sourceName;
        this.targetName = targetName;
    }

    async getSourceIdentities(domain) {
        return domain.getIdentities();
    }

    async getTargetIdentities(domain) {
        return domain.getIdentities();
    }

    async execute(parameters = {}) {
        const sourceDomain = getDomain(this.sourceName);
        const targetDomain = getDomain(this.targetName);

        if (!sourceDomain || !targetDomain) {
            throw new Error(`Domains not found: ${this.sourceName} or ${this.targetName}`);
        }

        if (parameters.forceRefresh) {
            sourceDomain.invalidate();
            targetDomain.invalidate();
        }

        const sourceRecords = await this.getSourceIdentities(sourceDomain);
        const targetRecords = await this.getTargetIdentities(targetDomain);

        const sourceDict = {};
        sourceRecords.forEach(r => sourceDict[r.userId] = r);

        const targetDict = {};
        targetRecords.forEach(r => targetDict[r.userId] = r);

        const diff = new Diff();
        
        const sourceProps = sourceDomain.supportedProperties || ['userId', 'firstName', 'lastName'];
        const targetProps = targetDomain.supportedProperties || ['userId', 'firstName', 'lastName'];
        const intersectedProperties = sourceProps.filter(p => targetProps.includes(p));

        let unchangedCount = 0;
        for (const userId in sourceDict) {
            if (!targetDict[userId]) {
                diff.added.push(sourceDict[userId]);
            } else {
                let isDifferent = false;
                for (const prop of intersectedProperties) {
                    if (sourceDict[userId][prop] !== targetDict[userId][prop]) {
                        isDifferent = true;
                        break;
                    }
                }
                if (isDifferent) {
                    diff.changed.push({
                        source: sourceDict[userId],
                        target: targetDict[userId]
                    });
                } else {
                    unchangedCount++;
                }
            }
        }

        for (const userId in targetDict) {
            if (!sourceDict[userId]) {
                diff.removed.push(targetDict[userId]);
            }
        }

        return { 
            success: true,
            details: {
                added: diff.added.map(a => ({ id: a.userId || a.id, new: a })),
                changed: diff.changed.map(c => ({ id: c.source.userId || c.source.id, old: c.target, new: c.source })),
                removed: diff.removed.map(r => ({ id: r.userId || r.id, old: r })),
                unchanged: unchangedCount
            },
            intersectedProperties,
            params: { source: this.sourceName, target: this.targetName } 
        };
    }
}

module.exports = DiffTask;
