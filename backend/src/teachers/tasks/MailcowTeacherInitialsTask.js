const axios = require('axios');
const Task = require('../../tasks/Task');
const { getDomain } = require('../../domains/registry');
const config = require('../../config');
const { isDevMode, limitInDevMode, devModeSuffix } = require('../../utils/devMode');

/**
 * MailcowTeacherInitialsTask
 *
 * Reads teacher initials (Kürzel) from the Schulkonsole domain and stores them
 * as custom_attributes on the corresponding Mailcow mailbox.
 *
 * Identity matching is performed via email address:
 *   Schulkonsole identity.email  ↔  Mailcow mailbox username (= email)
 *
 * Mailcow API:
 *   GET  /api/v1/get/mailbox/all   → read all mailboxes (incl. custom_attributes)
 *   POST /api/v1/edit/mailbox      → update mailbox attributes
 *
 * DevMode: In dev mode only 1 mailbox is updated to prevent accidental mass writes.
 */
class MailcowTeacherInitialsTask extends Task {
    constructor() {
        super('mailcow-teacher-initials');
    }

    async execute() {
        const devMode = isDevMode();
        const schulkonsoleTeacher = getDomain('schulkonsole-teacher');

        // ── Step 1: Read teacher identities from Schulkonsole ───────────────
        const identities = await schulkonsoleTeacher.getIdentities();

        // Build a map: lowercase email → Kürzel (userId)
        // Skip teachers where userId === login (no real initials, just userName fallback)
        const emailToInitials = new Map();
        const noInitials = [];
        const noEmail = [];
        for (const identity of identities) {
            if (!identity.email) {
                noEmail.push(identity.userId);
            } else if (identity.userId === identity.login) {
                noInitials.push(identity.email);
            } else {
                emailToInitials.set(identity.email.toLowerCase(), identity.userId);
            }
        }

        // ── Step 2: Read all Mailcow mailboxes ──────────────────────────────
        const mailcowConfig = config.mailcow || {};
        const apiURL = mailcowConfig.apiURL;
        const apiKey = mailcowConfig.apiKey;

        if (!apiURL || !apiKey) {
            return {
                success: false,
                error: 'Mailcow configuration incomplete. Missing apiURL or apiKey in config.'
            };
        }

        const headers = {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
        };

        let mailboxes;
        try {
            const res = await axios.get(`${apiURL}get/mailbox/all`, { headers, timeout: 15000 });
            mailboxes = res.data;
        } catch (e) {
            return {
                success: false,
                error: 'Mailcow mailbox read failed: ' + e.message
            };
        }

        // ── Step 3: Compare and collect patches ─────────────────────────────
        const patches = [];
        const alreadyCurrent = [];

        for (const mb of mailboxes) {
            const mbEmail = (mb.username || '').toLowerCase();
            const initials = emailToInitials.get(mbEmail);

            if (!initials) {
                // No matching teacher found in Schulkonsole for this mailbox
                continue;
            }

            // Check current custom_attributes
            const currentAttrs = mb.custom_attributes || {};
            if (currentAttrs.kuerzel === initials) {
                alreadyCurrent.push({ email: mbEmail, kuerzel: initials });
                continue;
            }

            patches.push({
                email: mbEmail,
                kuerzel: initials,
                oldKuerzel: currentAttrs.kuerzel || null,
                currentAttrs
            });
        }

        // Count teachers without matching Mailcow mailbox
        const matchedEmails = new Set();
        for (const mb of mailboxes) {
            const mbEmail = (mb.username || '').toLowerCase();
            if (emailToInitials.has(mbEmail)) matchedEmails.add(mbEmail);
        }
        const unmatchedTeachers = [];
        for (const [email, initials] of emailToInitials) {
            if (!matchedEmails.has(email)) {
                unmatchedTeachers.push({ email, kuerzel: initials });
            }
        }

        // ── Step 4: Apply patches (devMode limited) ─────────────────────────
        const { items: toProcess } = limitInDevMode(patches);

        const applied = [];
        const errors = [];

        for (const patch of toProcess) {
            try {
                // Mailcow routes custom attributes as /edit/mailbox/custom-attribute
                // with items[] for mailboxes and attr containing attribute[] + value[]
                await axios.post(`${apiURL}edit/mailbox/custom-attribute`, {
                    items: [patch.email],
                    attr: {
                        attribute: ['kuerzel'],
                        value: [patch.kuerzel]
                    }
                }, { headers, timeout: 15000 });

                applied.push({
                    id: patch.email,
                    old: { kuerzel: patch.oldKuerzel },
                    new: { kuerzel: patch.kuerzel }
                });
            } catch (e) {
                errors.push({
                    id: patch.email,
                    message: e.message
                });
            }
        }

        return {
            success: true,
            devMode,
            details: {
                totalTeachers: identities.length,
                totalMailboxes: mailboxes.length,
                matched: alreadyCurrent.length + patches.length,
                alreadyCurrent: alreadyCurrent.length,
                totalPending: patches.length,
                changed: applied,
                errors,
                skipped: patches.length - toProcess.length,
                unmatchedTeachers: unmatchedTeachers.length,
                unmatchedDetails: unmatchedTeachers.slice(0, 10),
                noInitials: noInitials.length,
                noEmail: noEmail.length
            }
        };
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
            html += `<div style="color: var(--wa-color-success-600); font-weight: bold;">${changedCount}/${totalPending} Kürzel aktualisiert${suffix}</div>`;
        } else if (totalPending === 0) {
            html += `<div style="color:var(--wa-color-neutral-500)">Alle Kürzel aktuell (${currentCount})${suffix}</div>`;
        } else {
            html += `<div style="color:var(--wa-color-neutral-500)">Keine Kürzel aktualisiert${suffix}</div>`;
        }

        if (unmatchedCount > 0) {
            html += `<div style="color:var(--wa-color-warning-600); font-size: 0.9em; margin-top: 0.25rem;">${unmatchedCount} Lehrer ohne Mailcow-Postfach</div>`;
        }

        if (details.errors && details.errors.length > 0) {
            html += `<div style="color:var(--wa-color-danger-600); font-size: 0.9em;">${details.errors.length} Fehler</div>`;
        }

        return html;
    }
}

module.exports = new MailcowTeacherInitialsTask();
