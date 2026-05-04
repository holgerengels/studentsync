class Task {
    constructor(name) {
        this.name = name;
    }

    async execute(parameters = {}) {
        throw new Error(`[Task] execute() must be implemented for ${this.name}`);
    }

    format(report) {
        if (!report) return '-';
        return `<div>Task ${this.name} executed successfully.</div>`;
    }

    summarize(report) {
        return this.format(report);
    }
}

module.exports = Task;
