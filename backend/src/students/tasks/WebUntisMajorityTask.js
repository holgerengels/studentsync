const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../../utils/devMode');

class WebUntisMajorityTask extends Task {
    constructor() {
        super('web-untis-majority');
    }

    async execute(parameters = {}) {
        const devMode = isDevMode();
        const untis = getDomain('webuntis');

        console.log(`[WebUntisMajorityTask] Fetching identities from WebUntis...`);
        const identities = await untis.readIdentities();
        const pendingUpdates = [];

        // Reference target date for 18 years
        // We use the current date at sync time
        const today = new Date();
        const cutoffDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());

        for (const student of identities) {
            // Only care about students (skipping externally injected teachers if they were swept up, though WebUntis domain maps class/birthday)
            if (!student.birthday) continue;

            const birthDate = new Date(student.birthday);
            if (isNaN(birthDate.getTime())) continue;

            // Check if they are 18+
            if (birthDate <= cutoffDate) {
                if (student.majority !== true) {
                    pendingUpdates.push(student);
                }
            }
        }

        const { items: updatesToProcess } = limitInDevMode(pendingUpdates);

        const updatedLog = [];
        const errorLog = [];

        for (const student of updatesToProcess) {
            try {
                // Send targeted update that asserts majority = true.
                const oldMajority = student.majority;
                student.majority = true;
                await untis.changeIdentity(student);
                updatedLog.push({ id: student.userId, old: { majority: oldMajority }, new: { majority: true } });
            } catch (e) {
                errorLog.push({ id: student.userId, message: `Update Error: ${e.message}` });
            }
        }

        return {
             success: true,
             devMode,
             details: {
                 totalUpdatesDiscovered: pendingUpdates.length,
                 changed: updatedLog,
                 errors: errorLog
             }
        };
    }
}

module.exports = WebUntisMajorityTask;
