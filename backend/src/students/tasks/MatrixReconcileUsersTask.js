const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');
const { isDevMode } = require('../../utils/devMode');
const mongoose = require('mongoose');

class MatrixReconcileUsersTask extends Task {
    constructor() {
        super('matrix-reconcile-users');
    }

    async execute(parameters = {}) {
        const matrix = getDomain('matrix');
        if (!matrix) {
            throw new Error('Matrix domain is not available.');
        }

        const devMode = isDevMode();
        const homeserverUrl = matrix.homeserverUrl;
        
        // Ensure MatrixModel is initialized/retrieved
        const MatrixModel = mongoose.models.MatrixIdentity || mongoose.model('MatrixIdentity');
        
        const docs = await MatrixModel.find({}).lean();
        
        let checkedCount = 0;
        let validCount = 0;
        let deletedCount = 0;
        let errorCount = 0;
        const errors = [];
        const deletedUserIds = [];

        // Concurrency chunking
        const chunkSize = 15;
        const chunks = [];
        for (let i = 0; i < docs.length; i += chunkSize) {
            chunks.push(docs.slice(i, i + chunkSize));
        }

        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (doc) => {
                const username = doc.login || doc.userId;
                checkedCount++;
                try {
                    const availableUrl = `${homeserverUrl}/_matrix/client/v3/register/available?username=${encodeURIComponent(username)}`;
                    const res = await fetch(availableUrl);
                    
                    if (res.status === 200) {
                        // status 200 means username is available -> user DOES NOT exist on Matrix server!
                        await MatrixModel.deleteOne({ _id: doc._id });
                        deletedCount++;
                        deletedUserIds.push(username);
                    } else if (res.status === 400) {
                        // status 400 (M_USER_IN_USE) means user exists on Matrix server
                        validCount++;
                    } else {
                        // unexpected status code
                        errorCount++;
                        const text = await res.text();
                        errors.push(`Failed to check user ${username}: Unexpected status ${res.status} - ${text}`);
                    }
                } catch (err) {
                    errorCount++;
                    errors.push(`Failed to check user ${username}: ${err.message}`);
                }
            }));
            
            // Brief pause between chunks to protect homeserver resources
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        return {
            success: errorCount === 0,
            details: {
                checked: checkedCount,
                valid: validCount,
                deleted: deletedCount,
                deletedUsers: deletedUserIds,
                errors: errors
            },
            devMode
        };
    }

    format(report) {
        if (!report) return '-';
        if (report.success === false && report.details?.errors?.length > 0) {
            return `<div style="color:var(--wa-color-danger-600)">Fehler bei der Überprüfung: ${report.details.errors[0]}</div>`;
        }

        const details = report.details || {};
        let summaryParts = [];
        
        summaryParts.push(`<span style="color: var(--wa-color-neutral-800)">Überprüft: ${details.checked || 0}</span>`);
        summaryParts.push(`<span style="color: var(--wa-color-success-600)">Existieren auf Matrix: ${details.valid || 0}</span>`);
        
        if (details.deleted > 0) {
            summaryParts.push(`<span style="color: var(--wa-color-danger-600)">Aus Cache gelöscht (nicht auf Matrix): ${details.deleted} (${details.deletedUsers.join(', ')})</span>`);
        } else {
            summaryParts.push(`<span style="color: var(--wa-color-neutral-500)">Keine ungültigen Cache-Einträge</span>`);
        }

        if (details.errors && details.errors.length > 0) {
            summaryParts.push(`<span style="color: #EF4444">Fehler: ${details.errors.length}</span>`);
        }

        return `<div>${summaryParts.join(', ')}</div>`;
    }
}

module.exports = MatrixReconcileUsersTask;
