const axios = require('axios');
const path = require('path');
const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');
const config = require('../../config');
const DomainMap = require('./DomainMap');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../../utils/devMode');

const configDir = path.join(__dirname, '../../../../config');

/**
 * ProfileMaintenanceTask — normalizes school metadata (schulname, schulort, rp)
 * on Fachnetz (Moodle) user profiles by looking up their email domain in CSV files.
 *
 * Port of the Java DomainMaintenanceTask from fachnetz-bs.
 *
 * Operates via the Moodle webservice API (core_user_update_users).
 * Respects devMode: in devMode only 1 profile is patched.
 */
class ProfileMaintenanceTask extends Task {
    constructor() {
        super('fachnetz-profile-maintenance');
    }

    async execute(parameters = {}) {
        const fachnetz = getDomain('fachnetz');
        const identities = await fachnetz.getIdentities();

        // Load domain map from CSV files
        const csvFiles = (config.domainMap?.paths || ['schulen.csv', 'andere.csv', 'ausser.csv'])
            .map(f => path.isAbsolute(f) ? f : path.join(configDir, f));
        const domainMap = new DomainMap(csvFiles);
        const cityMap = domainMap.getCityMap();

        const noschools = [];
        const patches = [];
        const normalized = [];
        const fuzzyMatches = [];

        for (const identity of identities) {
            if (!identity.email || !identity.email.includes('@')) {
                noschools.push({ identity, reason: 'no email' });
                continue;
            }

            const emailDomain = identity.email.split('@')[1];
            let school = domainMap.get(emailDomain);
            let matchSource = 'domain';

            // Fallback: fuzzy match when email domain is unknown (ZSL, KM, IBBW, bw.schule, etc.)
            // Or when domain is from ausser.csv but user provided a specific school name AND city
            let attemptFuzzy = false;
            if (!school && (identity.schulname || identity.schulort)) {
                attemptFuzzy = true;
            } else if (school && school.isAusser && identity.schulname && identity.schulort) {
                attemptFuzzy = true;
            }

            if (attemptFuzzy) {
                const fuzzy = domainMap.fuzzyMatch(identity.schulname, identity.schulort);
                if (fuzzy) {
                    school = fuzzy.school;
                    matchSource = 'fuzzy';
                    fuzzyMatches.push({
                        userId: identity.userId,
                        email: identity.email,
                        profileSchule: identity.schulname,
                        profileOrt: identity.schulort,
                        matchedSchule: school.name,
                        matchedOrt: school.city,
                        score: Math.round(fuzzy.score * 100) / 100
                    });
                }
            }

            const rp = cityMap.get(identity.schulort);

            if (!school && !rp) {
                noschools.push({ identity, reason: emailDomain });
                continue;
            }

            // Check if already normalized
            if (school && school.name === identity.schulname
                && school.city === identity.schulort
                && school.rp === identity.rp) {
                normalized.push(identity);
                continue;
            }
            if (!school && rp && rp === identity.rp) {
                normalized.push(identity);
                continue;
            }

            // Build patch
            const patch = {};
            const oldValues = {};
            if (school) {
                if (school.name !== identity.schulname) {
                    patch.Schulname = school.name;
                    oldValues.Schulname = identity.schulname || '';
                }
                if (school.city !== identity.schulort) {
                    patch.Schulort = school.city;
                    oldValues.Schulort = identity.schulort || '';
                }
                if (school.rp !== identity.rp) {
                    patch.RP = school.rp;
                    oldValues.RP = identity.rp || '';
                }
            } else if (rp) {
                if (rp !== identity.rp) {
                    patch.RP = rp;
                    oldValues.RP = identity.rp || '';
                }
            }

            if (Object.keys(patch).length > 0) {
                patches.push({ identity, patch, oldValues, matchSource });
            } else {
                normalized.push(identity);
            }
        }

        // Apply patches via Moodle webservice
        const devMode = isDevMode();
        const { items: toProcess } = limitInDevMode(patches);
        const applied = [];
        const errors = [];

        const moodleConfig = config.moodle || {};
        const serviceUrl = (moodleConfig.url || '') + (moodleConfig.servicepath || 'webservice/rest/server.php');
        const serviceToken = moodleConfig.servicetoken;
        const serviceFunction = moodleConfig.servicefunction || 'core_user_update_users';

        if (!serviceToken) {
            return {
                success: false,
                error: 'Moodle servicetoken not configured',
                noschools: noschools.length,
                patches: patches.length,
                normalized: normalized.length
            };
        }

        let successCount = 0;
        let i = 0;
        while (successCount < toProcess.length && i < patches.length) {
            const { identity, patch, oldValues, matchSource } = patches[i];
            try {
                await this._fixProfile(serviceUrl, serviceToken, serviceFunction, identity, patch, oldValues);
                applied.push({ userId: identity.userId, id: identity.id, patch, oldValues, matchSource });
                successCount++;
            } catch (e) {
                errors.push({ userId: identity.userId, id: identity.id, error: e.message });
                // If it's a blocked admin account, we don't count it towards the devMode limit.
                // This allows the loop to bypass admins and keep trying until it finds a regular user.
                if (!e.message.includes('usernotupdatedadmin')) {
                    successCount++;
                }
            }
            i++;
        }

        // Invalidate cache after modifications
        if (applied.length > 0) {
            fachnetz.invalidate();
        }

        // Calculate aggregate statistics for the report summary
        const patchCounts = {};
        for (const p of patches) {
            for (const k of Object.keys(p.patch)) {
                patchCounts[k] = (patchCounts[k] || 0) + 1;
            }
        }

        return {
            success: true,
            devMode,
            details: {
                total: identities.length,
                normalized: normalized.length,
                patches: patches.length,
                fuzzyMatches: fuzzyMatches.length,
                noschools: noschools.length,
                changed: applied.map(a => ({ id: a.id, userId: a.userId, old: a.oldValues, new: a.patch, matchSource: a.matchSource })),
                errors: errors.map(e => ({ id: e.id, userId: e.userId, message: e.error })),
                skipped: patches.length - successCount,
                skippedDetails: devMode ? patches.slice(i, i + 10).map(p => ({
                    id: p.identity.id,
                    userId: p.identity.userId,
                    old: p.oldValues,
                    new: p.patch
                })) : [],
                fuzzyMatchDetails: fuzzyMatches.slice(0, 10),
                noschoolDetails: noschools.slice(0, 10).map(n => ({
                    userId: n.identity.userId,
                    email: n.identity.email,
                    reason: n.reason
                }))
            }
        };
    }

    format(report) {
        if (!report || !report.details) return '-';

        let html = '';
        const suffix = devModeSuffix(report.devMode);
        
        const details = report.details;
        const changedCount = details.changed ? details.changed.length : 0;
        const noschoolsCount = details.noschools || 0;
        const fuzzyCount = details.fuzzyMatches || 0;

        if (changedCount > 0) {
            html += `<div style="color: var(--wa-color-success-600); font-weight: bold;">${changedCount} Profile aktualisiert${suffix}</div>`;
        } else {
            html += `<div style="color:var(--wa-color-neutral-500)">Keine Profile aktualisiert${suffix}</div>`;
        }

        if (noschoolsCount > 0) {
            html += `<div style="color:var(--wa-color-warning-600); font-size: 0.9em; margin-top: 0.25rem;">${noschoolsCount} Profile ohne zuordenbare Schule</div>`;
        }

        if (fuzzyCount > 0) {
            html += `<div style="color:var(--wa-color-primary-600); font-size: 0.9em;">${fuzzyCount} Profile über Fuzzy-Match zugeordnet</div>`;
        }

        return html;
    }

    /**
     * Update Moodle user custom fields via webservice API.
     * Equivalent of the Java fix() method.
     */
    async _fixProfile(serviceUrl, token, wsfunction, identity, patch, oldValues) {
        const params = new URLSearchParams();
        params.append('wstoken', token);
        params.append('wsfunction', wsfunction);
        params.append('moodlewsrestformat', 'json');
        params.append('users[0][id]', identity.id);

        let i = 0;
        for (const [fieldName, value] of Object.entries(patch)) {
            params.append(`users[0][customfields][${i}][type]`, fieldName);
            params.append(`users[0][customfields][${i}][value]`, value);
            i++;
        }

        const res = await axios.post(serviceUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
        });

        // Moodle returns {"warnings":[]} on success
        if (res.data && res.data.warnings && res.data.warnings.length === 0) {
            console.log(`[ProfileMaintenance] fixed ${identity.id}: ${identity.userId} old: ${JSON.stringify(oldValues)} new: ${JSON.stringify(patch)}`);
        } else {
            const msg = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            console.error(`[ProfileMaintenance] error ${identity.id}: ${identity.userId} ${msg}`);
            throw new Error(msg);
        }
    }
}

module.exports = ProfileMaintenanceTask;
