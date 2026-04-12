const Task = require('./Task');
const Diff = require('../utils/Diff');
const { getDomain } = require('../domains/registry');

class DiffTask extends Task {
    constructor(sourceName, targetName) {
        super(`${sourceName}-${targetName}-diff`);
        this.sourceName = sourceName;
        this.targetName = targetName;
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

        const sourceRecords = await sourceDomain.getIdentities();
        const targetRecords = await targetDomain.getIdentities();

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

        return { diff, unchangedCount, intersectedProperties, params: { source: this.sourceName, target: this.targetName } };
    }

    format(report) {
         if (!report) return '-';
        if (report.error) {
            return `<span style="color: #EF4444;">Fehler: ${report.error}</span>`;
        }
        
        const details = report.diff;
        if (!details) return '-';

        let summaryParts = [];
        if (report.params && report.params.source && report.params.target) {
             summaryParts.push(`<strong>${report.params.source} &rarr; ${report.params.target}</strong>`);
        }
        
        if (details.added.length || details.removed.length || details.changed.length) {
            summaryParts.push(`<span style="color: #10B981; font-weight: bold;">+${details.added.length}</span>`);
            summaryParts.push(`<span style="color: #F59E0B; font-weight: bold;">~${details.changed.length}</span>`);
            summaryParts.push(`<span style="color: #EF4444; font-weight: bold;">-${details.removed.length}</span>`);
            return summaryParts.join(' ');
        }
        
        return '-';
    }
}

module.exports = DiffTask;
