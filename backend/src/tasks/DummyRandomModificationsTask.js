const DummyDomain = require('../domains/DummyDomain');
const crypto = require('crypto');

class DummyRandomModificationsTask {
    async execute() {
        const dummy = new DummyDomain();
        const identities = await dummy.getIdentities();
        
        let removedArr = [];
        let changedArr = [];
        let addedArr = [];
        
        // Remove up to 2
        const toRemove = identities.slice(0, 2);
        for (const id of toRemove) {
            await dummy.removeIdentity(id);
            removedArr.push(id.userId);
        }
        
        // Change up to 2
        const toChange = identities.slice(2, 4);
        for (const id of toChange) {
            id.lastName = id.lastName + ' (Mod)';
            await dummy.changeIdentity(id);
            changedArr.push(id.userId);
        }
        
        // Add 2 new ones
        for (let i = 0; i < 2; i++) {
            const rId = crypto.randomBytes(3).toString('hex');
            await dummy.addIdentity({
                userId: `dummy${rId}`,
                firstName: 'New',
                lastName: `User ${rId}`
            });
            addedArr.push(`dummy${rId}`);
        }
        
        return { 
             removed: removedArr.length, 
             changed: changedArr.length, 
             added: addedArr.length,
             syncLog: {
                 added: addedArr,
                 changed: changedArr,
                 removed: removedArr,
                 errors: []
             }
        };
    }

    summarize(report) {
        if (!report) return '-';
        return `<div style="text-align: left; display: inline-block;">
            <div style="color: var(--wa-color-danger-600); font-weight: bold;">- ${report.removed} gelöscht</div>
            <div style="color: var(--wa-color-warning-600); font-weight: bold;">~ ${report.changed} geändert</div>
            <div style="color: var(--wa-color-success-600); font-weight: bold;">+ ${report.added} hinzugefügt</div>
        </div>`;
    }
}

module.exports = DummyRandomModificationsTask;
