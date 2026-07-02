const ldap = require('ldapjs');
const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');
const config = require('../../config');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../../utils/devMode');

/**
 * VerwaltungsnetzTeacherLoginsTask
 *
 * Reads teacher logins from the Schulkonsole domain and stores them
 * in the employeeID attribute of the corresponding Verwaltungsnetz LDAP account.
 *
 * Identity matching is performed via teacher initials (Kürzel):
 *   Schulkonsole identity.userId (= initials)  ↔  LDAP initials attribute
 *
 * DevMode: In dev mode only 1 LDAP entry is updated to prevent accidental mass writes.
 */
class VerwaltungsnetzTeacherLoginsTask extends Task {
    constructor() {
        super('verwaltungsnetz-teacher-logins');
    }

    async execute() {
        const devMode = isDevMode();
        const schulkonsoleTeacher = getDomain('schulkonsole-teacher');

        // ── Step 1: Read teacher identities from Schulkonsole ───────────────
        const identities = await schulkonsoleTeacher.getIdentities();

        // Build a map: initials (userId) → login
        const initialsToLogin = new Map();
        const noLogin = [];
        for (const identity of identities) {
            if (!identity.login) {
                noLogin.push(identity.userId);
            } else {
                initialsToLogin.set(identity.userId, identity.login);
            }
        }

        // ── Step 2: Read LDAP accounts and find those needing an update ─────
        const ldapConfig = config.vbsdc;

        if (!ldapConfig) {
            return {
                success: false,
                error: 'Verwaltungsnetz LDAP configuration missing (config.vbsdc).'
            };
        }

        let ldapEntries;
        try {
            ldapEntries = await this._readLdapEntries(ldapConfig);
        } catch (e) {
            return {
                success: false,
                error: 'LDAP read failed: ' + e.message
            };
        }

        // ── Step 3: Compare and collect patches ─────────────────────────────
        const patches = [];
        const alreadyCurrent = [];
        const unmatchedLdap = [];

        for (const entry of ldapEntries) {
            const initials = entry.initials;
            if (!initials) continue;

            const login = initialsToLogin.get(initials);

            if (!login) {
                unmatchedLdap.push({ dn: entry.dn, initials });
                continue;
            }

            if (entry.employeeID === login) {
                alreadyCurrent.push({ initials, login });
                continue;
            }

            patches.push({
                dn: entry.dn,
                initials,
                login,
                oldEmployeeID: entry.employeeID || null
            });
        }

        // Count teachers without matching LDAP entry
        const matchedInitials = new Set();
        for (const entry of ldapEntries) {
            if (entry.initials && initialsToLogin.has(entry.initials)) {
                matchedInitials.add(entry.initials);
            }
        }
        const unmatchedTeachers = [];
        for (const [initials, login] of initialsToLogin) {
            if (!matchedInitials.has(initials)) {
                unmatchedTeachers.push({ initials, login });
            }
        }

        // ── Step 4: Apply patches (devMode limited) ─────────────────────────
        const { items: toProcess } = limitInDevMode(patches);

        const applied = [];
        const errors = [];

        for (const patch of toProcess) {
            try {
                await this._writeLdapAttribute(ldapConfig, patch.dn, 'employeeID', patch.login);
                applied.push({
                    id: patch.initials,
                    old: { employeeID: patch.oldEmployeeID },
                    new: { employeeID: patch.login }
                });
            } catch (e) {
                errors.push({
                    id: patch.initials,
                    message: e.message
                });
            }
        }

        return {
            success: true,
            devMode,
            details: {
                totalTeachers: identities.length,
                totalLdapEntries: ldapEntries.length,
                matched: alreadyCurrent.length + patches.length,
                alreadyCurrent: alreadyCurrent.length,
                totalPending: patches.length,
                changed: applied,
                errors,
                skipped: patches.length - toProcess.length,
                unmatchedTeachers: unmatchedTeachers.length,
                unmatchedTeacherDetails: unmatchedTeachers.slice(0, 10),
                unmatchedLdap: unmatchedLdap.length,
                noLogin: noLogin.length
            }
        };
    }

    /**
     * Reads all person entries from the Verwaltungsnetz LDAP,
     * returning dn, initials and employeeID for each.
     */
    _readLdapEntries(ldapConfig) {
        return new Promise((resolve, reject) => {
            const client = ldap.createClient({ url: ldapConfig.url });

            client.on('error', (err) => {
                reject(new Error('LDAP Connection Error: ' + err.message));
            });

            client.bind(ldapConfig.binddn, ldapConfig.bindpw, (err) => {
                if (err) {
                    client.unbind();
                    return reject(new Error('LDAP Bind Error: ' + err.message));
                }

                const opts = {
                    filter: ldapConfig.userfilter || '(objectClass=person)',
                    scope: 'sub',
                    attributes: ['dn', 'initials', 'employeeID', 'sAMAccountName']
                };

                const baseDN = ldapConfig.basedn
                    || ldapConfig.binddn.split(',').filter(p => /^DC=/i.test(p)).join(',');

                client.search(baseDN, opts, (err, searchRes) => {
                    if (err) {
                        client.unbind();
                        return reject(new Error('LDAP Search Error: ' + err.message));
                    }

                    const entries = [];

                    searchRes.on('searchEntry', (entry) => {
                        // Keep objectName as DN object — avoids string roundtrip
                        // that can break modify() for DNs with umlauts
                        const dn = entry.objectName || null;

                        let obj;
                        if (entry.object) {
                            obj = entry.object;
                        } else {
                            obj = {};
                            if (entry.attributes) {
                                entry.attributes.forEach(attr => {
                                    obj[attr.type] = attr.values && attr.values.length === 1
                                        ? attr.values[0]
                                        : attr.values;
                                });
                            }
                        }

                        const initials = (Array.isArray(obj.initials) ? obj.initials[0] : obj.initials || '').trim();
                        const employeeID = (Array.isArray(obj.employeeID) ? obj.employeeID[0] : obj.employeeID || '').trim();

                        // Simplified: directly add entry
                        entries.push({ dn, initials, employeeID: employeeID || null });
                    });

                    searchRes.on('end', () => {
                        client.unbind();
                        resolve(entries);
                    });

                    searchRes.on('error', (err) => {
                        client.unbind();
                        reject(new Error('LDAP Search Stream Error: ' + err.message));
                    });
                });
            });
        });
    }

    /**
     * Decodes hex-escaped UTF-8 byte sequences in LDAP DN strings.
     * ldapjs serializes umlauts as \c3\bc (ü), \c3\b6 (ö), etc.
     * AD expects raw UTF-8 characters in DNs, so we decode them back.
     */
    _unescapeDN(dnStr) {
        return dnStr.replace(/(\\[0-9a-fA-F]{2})+/g, (match) => {
            const bytes = [];
            for (let i = 0; i < match.length; i += 3) {
                bytes.push(parseInt(match.substr(i + 1, 2), 16));
            }
            return Buffer.from(bytes).toString('utf8');
        });
    }

    /**
     * Writes a single attribute value to an LDAP entry.
     * Uses 'replace' modification (creates or updates the attribute).
     *
     * NOTE: We build the ModifyRequest manually instead of using client.modify()
     * because client.modify() runs the DN through parseDN(), which hex-escapes
     * UTF-8 characters like umlauts (ü → \c3\bc). AD then cannot find the entry.
     */
    _writeLdapAttribute(ldapConfig, dn, attributeName, value) {
        return new Promise((resolve, reject) => {
            const client = ldap.createClient({ url: ldapConfig.url });

            client.on('error', (err) => {
                reject(new Error('LDAP Connection Error: ' + err.message));
            });

            client.bind(ldapConfig.binddn, ldapConfig.bindpw, (err) => {
                if (err) {
                    client.unbind();
                    return reject(new Error('LDAP Bind Error: ' + err.message));
                }

                const change = new ldap.Change({
                    operation: 'replace',
                    modification: {
                        type: attributeName,
                        values: [value]
                    }
                });

                // Use unescaped UTF-8 DN string and set it directly on the
                // ModifyRequest to bypass ldapjs's parseDN() escaping
                const dnStr = this._unescapeDN(dn.toString());
                const req = new ldap.ModifyRequest();
                req.object = dnStr;
                req.changes = [change];

                client._send(req, [ldap.LDAPResult], null, (err) => {
                    client.unbind();
                    if (err) {
                        return reject(new Error(`LDAP Modify Error for ${dnStr}: ${err.message}`));
                    }
                    resolve();
                });
            });
        });
    }

    format(report) {
        if (!report || !report.details) return '-';

        let html = '';
        const suffix = devModeSuffix(report.devMode);
        const details = report.details;

        const changedCount = details.changed ? details.changed.length : 0;
        const currentCount = details.alreadyCurrent || 0;
        const totalPending = details.totalPending || 0;
        const unmatchedCount = details.unmatchedTeachers || 0;

        if (changedCount > 0) {
            html += `<div style="color: var(--wa-color-success-600); font-weight: bold;">${changedCount}/${totalPending} Logins aktualisiert${suffix}</div>`;
        } else if (totalPending === 0) {
            html += `<div style="color:var(--wa-color-neutral-500)">Alle Logins aktuell (${currentCount})${suffix}</div>`;
        } else {
            html += `<div style="color:var(--wa-color-neutral-500)">Keine Logins aktualisiert${suffix}</div>`;
        }

        if (unmatchedCount > 0) {
            html += `<div style="color:var(--wa-color-warning-600); font-size: 0.9em; margin-top: 0.25rem;">${unmatchedCount} Lehrer ohne LDAP-Eintrag</div>`;
        }

        if (details.errors && details.errors.length > 0) {
            html += `<div style="color:var(--wa-color-danger-600); font-size: 0.9em;">${details.errors.length} Fehler</div>`;
        }

        return html;
    }
}

module.exports = new VerwaltungsnetzTeacherLoginsTask();
