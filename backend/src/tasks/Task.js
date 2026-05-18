class Task {
    constructor(name) {
        this.name = name;
    }

    async execute(parameters = {}) {
        throw new Error(`[Task] execute() must be implemented for ${this.name}`);
    }

    format(report) {
        if (!report) return '-';
        if (report.success === false) return `<div style="color:var(--wa-color-danger-600)">Fehler: ${report.error || 'Unbekannter Fehler'}</div>`;

        let summaryParts = [];
        if (report.details) {
            for (const [key, val] of Object.entries(report.details)) {
                if (Array.isArray(val) && val.length > 0) {
                    let color = 'var(--wa-color-neutral-800)';
                    let label = key.charAt(0).toUpperCase() + key.slice(1);
                    if (key === 'added') color = 'var(--wa-color-success-600)';
                    else if (key === 'changed' || key === 'updated') color = 'var(--wa-color-warning-600)';
                    else if (key === 'removed' || key === 'deleted') color = 'var(--wa-color-danger-600)';
                    else if (key === 'errors') color = '#EF4444';
                    
                    summaryParts.push(`<span style="color: ${color}">${label}: ${val.length}</span>`);
                } else if (typeof val === 'number' && val > 0) {
                    let label = key.charAt(0).toUpperCase() + key.slice(1);
                    summaryParts.push(`<span style="color: var(--wa-color-neutral-600)">${label}: ${val}</span>`);
                }
            }
        }
        
        if (summaryParts.length === 0) {
            summaryParts.push('<span style="color:var(--wa-color-neutral-500)">Keine Änderungen</span>');
        }

        let msg = `<div>${summaryParts.join(', ')}`;
        if (report.devMode) {
             msg += ` <span style="color:var(--wa-color-warning-600); font-size:0.9em;">(DevMode)</span>`;
        }
        msg += `</div>`;
        return msg;
    }

    summarize(report) {
        return this.format(report);
    }
}

module.exports = Task;
