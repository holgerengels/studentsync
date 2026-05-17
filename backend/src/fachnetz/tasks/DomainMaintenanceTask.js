const axios = require('axios');
const path = require('path');
const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');
const config = require('../../config');
const DomainMap = require('./DomainMap');

const configDir = path.join(__dirname, '../../../../config');

/**
 * DomainMaintenanceTask — normalizes school metadata (schulname, schulort, rp)
 * on Fachnetz (Moodle) user profiles by looking up their email domain in CSV files.
 *
 * Port of the Java DomainMaintenanceTask from fachnetz-bs.
 *
 * Operates via the Moodle webservice API (core_user_update_users).
 * Respects devMode: in devMode only 1 profile is patched.
 */
class DomainMaintenanceTask extends Task {
    constructor() {
        super('fachnetz-domain-maintenance');
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
            if (!school && (identity.schulname || identity.schulort)) {
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
            if (school) {
                if (school.name !== identity.schulname) patch.Schulname = school.name;
                if (school.city !== identity.schulort) patch.Schulort = school.city;
                if (school.rp !== identity.rp) patch.RP = school.rp;
            } else if (rp) {
                if (rp !== identity.rp) patch.RP = rp;
            }

            if (Object.keys(patch).length > 0) {
                patches.push({ identity, patch, matchSource });
            } else {
                normalized.push(identity);
            }
        }

        // Apply patches via Moodle webservice
        const devMode = config.settings?.devMode !== false;
        const limit = devMode ? 1 : patches.length;
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

        for (let i = 0; i < limit; i++) {
            const { identity, patch, matchSource } = patches[i];
            try {
                await this._fixProfile(serviceUrl, serviceToken, serviceFunction, identity, patch);
                applied.push({ userId: identity.userId, id: identity.id, patch, matchSource });
            } catch (e) {
                errors.push({ userId: identity.userId, id: identity.id, error: e.message });
            }
        }

        // Invalidate cache after modifications
        if (applied.length > 0) {
            fachnetz.invalidate();
        }

        return {
            success: true,
            devMode,
            total: identities.length,
            normalized: normalized.length,
            patches: patches.length,
            fuzzyMatches: fuzzyMatches.length,
            noschools: noschools.length,
            applied,
            errors,
            skipped: devMode ? patches.length - limit : 0,
            fuzzyMatchDetails: fuzzyMatches.slice(0, 20),
            noschoolDetails: noschools.slice(0, 20).map(n => ({
                userId: n.identity.userId,
                email: n.identity.email,
                reason: n.reason
            }))
        };
    }

    /**
     * Update Moodle user custom fields via webservice API.
     * Equivalent of the Java fix() method.
     */
    async _fixProfile(serviceUrl, token, wsfunction, identity, patch) {
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
            console.log(`[DomainMaintenance] fixed ${identity.id}: ${identity.userId} ${JSON.stringify(patch)}`);
        } else {
            const msg = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            console.error(`[DomainMaintenance] error ${identity.id}: ${identity.userId} ${msg}`);
            throw new Error(msg);
        }
    }

    format(report) {
        if (!report) return '-';
        if (!report.success) return `<div style="color:var(--wa-color-danger-600)">Fehler: ${report.error}</div>`;

        let html = `<div><strong>Domain Maintenance</strong>`;
        html += ` — ${report.total} Profile, ${report.normalized} normalisiert, ${report.patches} Patches`;
        if (report.fuzzyMatches) html += ` (${report.fuzzyMatches} fuzzy)`;
        html += `, ${report.noschools} ohne Schule</div>`;

        if (report.devMode) {
            html += `<div style="color:var(--wa-color-warning-600)">DevMode: nur ${report.applied.length} von ${report.patches} Patches angewendet</div>`;
        }

        if (report.applied.length > 0) {
            html += '<ul>' + report.applied.map(a =>
                `<li>✅ ${a.userId}: ${JSON.stringify(a.patch)}${a.matchSource === 'fuzzy' ? ' 🔍' : ''}</li>`
            ).join('') + '</ul>';
        }

        if (report.errors.length > 0) {
            html += '<ul>' + report.errors.map(e =>
                `<li style="color:var(--wa-color-danger-600)">❌ ${e.userId}: ${e.error}</li>`
            ).join('') + '</ul>';
        }

        return html;
    }
}

module.exports = DomainMaintenanceTask;
