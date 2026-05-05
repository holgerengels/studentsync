const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const otpauth = require('otpauth');
const Identity = require('./Identity');
const config = require('../config');
const ManagableDomain = require('./ManagableDomain');
const { parseTsvLine } = require('../utils/csvParser');

class WebUntisDomain extends ManagableDomain {
    get supportedProperties() { return ['userId', 'firstName', 'lastName', 'clazz', 'birthday']; }
    get cacheTTL() { return 3600000; } // 1 hour

    constructor() {
        super('webuntis');
        const c = config.webuntis || {};
        this.url = c.url;
        if (!this.url) throw new Error('WebUntis url missing');
        if (!this.url.endsWith('/')) this.url += '/';

        this.loginPath = c.login || 'j_spring_security_check?school=VU';
        if (this.loginPath.startsWith('/')) this.loginPath = this.loginPath.substring(1);

        this.reportPath = c.report || 'reports.do';
        if (this.reportPath.startsWith('/')) this.reportPath = this.reportPath.substring(1);

        this.fetchStudents = c.fetchStudents || 'name=Student&format=csv&klasseId=-1&studentsForDate=true&context=klasseId';

        this.user = c.user || process.env.WEBUNTIS_USER;
        this.password = c.password || process.env.WEBUNTIS_PASSWORD;
        this.secret = c.secret || process.env.WEBUNTIS_SECRET;

        if (!this.user || !this.password) {
            throw new Error('WebUntis configuration incomplete. Missing user or password.');
        }
    }

    /**
     * Poll for a WebUntis report until CSV data is returned.
     * WebUntis generates reports asynchronously — the initial request returns a messageId,
     * and the report may not be ready immediately.
     * 
     * @param {object} client - authenticated axios client
     * @param {string} messageId - report message ID from the generation request
     * @param {string} reportParams - query parameters for the report
     * @param {string} label - human-readable label for logging
     * @returns {string} CSV content
     */
    async _pollReport(client, messageId, reportParams, label = 'report') {
        const maxAttempts = 5;
        const delays = [2000, 4000, 6000, 8000, 10000]; // escalating wait times

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const delay = delays[attempt - 1] || 10000;
            await new Promise(r => setTimeout(r, delay));

            const res = await client.get(this.url + this.reportPath + '?msgId=' + messageId + '&' + reportParams);
            const data = res.data;

            if (typeof data === 'string' && data.trim().length > 0) {
                if (attempt > 1) {
                    console.log(`[WebUntis] ${label} ready after attempt ${attempt} (${delays.slice(0, attempt).reduce((a, b) => a + b, 0) / 1000}s total)`);
                }
                return data;
            }

            console.warn(`[WebUntis] ${label} not ready after ${delay / 1000}s (attempt ${attempt}/${maxAttempts}). Retrying...`);
        }

        throw new Error(`WebUntis ${label} did not become ready after ${maxAttempts} attempts. Server may be overloaded.`);
    }

    async readIdentities() {
        const jar = new CookieJar();
        const client = wrapper(axios.create({ jar, timeout: 5000 }));

        try {
            let token = '';
            if (this.secret) {
                const totp = new otpauth.TOTP({
                    issuer: 'WebUntis',
                    label: this.user,
                    algorithm: 'SHA1',
                    digits: 6,
                    period: 30,
                    secret: this.secret
                });
                token = totp.generate();
            }

            // WebUntis requires initial GET for JSESSIONID before POSTing spring security check
            await client.get(this.url, { validateStatus: false });

            const params = new URLSearchParams();
            params.append('j_username', this.user);
            params.append('j_password', this.password);
            if (token) params.append('token', token);

            await client.post(this.url + this.loginPath, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                maxRedirects: 0,
                validateStatus: false
            });

            // Keep the authenticated client for potential updates
            this.authClient = client;

            const genRes = await client.get(this.url + this.reportPath + '?' + this.fetchStudents);
            if (!genRes.data || !genRes.data.data) {
                console.error('WebUntis genRes.data.data is undefined!', genRes.data);
                throw new Error('WebUntis did not return valid report data. Login or configuration issue possibly occurred.');
            }

            const data = genRes.data.data;
            const messageId = data.messageId;
            const reportParams = data.reportParams;

            const csv = await this._pollReport(client, messageId, reportParams, 'Student CSV');

            const lines = csv.split('\n');
            const identities = [];
            this.internalIds = {};

            // Parse headers
            let majorityColIdx = -1;
            if (lines.length > 0) {
                const headers = parseTsvLine(lines[0].trim());
                majorityColIdx = headers.indexOf('majority');
                if (majorityColIdx === -1) {
                    console.warn('[WebUntis Info] "majority" column missing in WebUntis CSV export headers. Automatic majority resolving disabled.');
                }
            }

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cols = parseTsvLine(line);
                if (cols.length >= 6) {
                    const externKey = cols[0];
                    const lastName = cols[1];
                    const firstName = cols[2];
                    const genderStr = cols[3];
                    const birthdayStr = cols[4];
                    const clazz = cols[5];
                    const internalId = cols.length > 9 ? cols[9] : undefined;
                    const accountId = externKey || internalId || `idx-${i}`;

                    let majorityFlag = false;
                    if (majorityColIdx !== -1 && cols.length > majorityColIdx) {
                        const val = cols[majorityColIdx] ? cols[majorityColIdx].toLowerCase() : '';
                        majorityFlag = (val === 'true');
                    }

                    if (lastName === 'Tester_Schüler' || accountId === 'Tester_Schüler') {
                        // console.log(`[CSV DUMP] Tester_Schüler columns:`, cols);
                        this.testerCsv = cols; // Expose for our HTTP API inspection route!
                    }

                    if (internalId && accountId) {
                        this.internalIds[accountId] = internalId;
                    }

                    let birthday = null;
                    if (birthdayStr && birthdayStr.includes('.')) {
                        const parts = birthdayStr.split('.');
                        if (parts.length === 3) {
                            const day = parts[0];
                            const month = parts[1];
                            const year = parts[2];
                            birthday = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                        }
                    }

                    let normGender = null;
                    if (genderStr) {
                        const str = genderStr.toUpperCase();
                        if (str.startsWith('M') || str === '1ÄNNLICH') normGender = 'M';
                        else if (str.startsWith('W') || str.startsWith('F')) normGender = 'W';
                        else normGender = 'D';
                    }

                    identities.push(new Identity(
                        accountId,
                        firstName,
                        lastName,
                        {
                            domain: 'webuntis',
                            id: accountId,
                            gender: normGender,
                            clazz,
                            birthday,
                            majority: majorityFlag
                        }
                    ));
                }
            }

            return identities.sort((a, b) => (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName));

        } catch (e) {
            console.error('WebUntis read error:', e.message);
            throw new Error('WebUntis read error: ' + e.message);
        }
    }

    async changeIdentity(identity) {
        if (!this.internalIds) await this.getIdentities();

        const internalId = this.internalIds[identity.userId];
        if (!internalId) throw new Error(`Cannot change WebUntis identity: No internalId found for account ${identity.userId}`);

        if (!this.authClient) throw new Error(`WebUntis authClient not initialized. Core login failed.`);

        try {
            // Fetch CSRF token via index.do
            const indexRes = await this.authClient.get(this.url + 'index.do', { validateStatus: false });
            const htmlStr = typeof indexRes.data === 'string' ? indexRes.data : JSON.stringify(indexRes.data);
            const csrfMatch = htmlStr.match(/"csrfToken"\s*:\s*"([^"]+)"/) || htmlStr.match(/csrfToken":"([^"]+)"/);
            const csrfToken = csrfMatch ? csrfMatch[1] : '';

            // Scrape the form to preserve enrollments
            // Do not GET the studentform.do here. Fetching it via GET populates Spring's 
            // @SessionAttributes. If we then POST back without the exact `lastUpdate` 
            // from the internal JSON model, it throws an Optimistic Locking Failure 
            // ("Gleichzeitiger Benutzerzugriff"). By skipping the GET and POSTing directly, 
            // Spring binds our payload directly to a freshly fetched entity, preserving 
            // unsubmitted fields (like entryExitDateRanges) automatically.

            const savePayload = new URLSearchParams();
            if (csrfToken) savePayload.append('_csrf', csrfToken);
            savePayload.append('request.preventCache', String(Date.now()));
            savePayload.append('change', 'change');
            savePayload.append('selId', internalId);
            savePayload.append('id', internalId);

            // In WebUntis: name = short name, longName = last name, foreName = first name
            // Use .set() to replace the scraped values
            savePayload.set('name', identity.userId || '');
            savePayload.set('longName', identity.lastName || identity.userId || '');
            if (identity.firstName) savePayload.set('foreName', identity.firstName);
            savePayload.set('externKey', identity.userId || '');

            // Format YYYY-MM-DD as explicitly required by Dojo for birthDate
            if (identity.birthday) {
                savePayload.set('birthDate', identity.birthday); // already in YYYY-MM-DD
            }

            // Identity uses strictly uppercase M, W, D
            let webuntisGender = '';
            if (identity.gender === 'M') webuntisGender = '2';
            else if (identity.gender === 'W') webuntisGender = '1';
            else if (identity.gender === 'D') webuntisGender = '3';

            if (webuntisGender) {
                savePayload.set('genderId', webuntisGender);
            }

            // Honor majority toggle if passed in
            if (identity.majority === true) {
                savePayload.set('majority', 'true');
                savePayload.set('_majority', 'on');
            } else if (identity.majority === false) {
                // To set a checkbox to false in Spring, omit the boolean value but send the hidden _ parameter
                savePayload.set('_majority', 'on');
            }

            savePayload.set('active', 'true');
            savePayload.set('_active', 'on');

            const payloadString = savePayload.toString();
            // console.log(`[Domain] Prepared sparse POST payload for student ${internalId}`);

            const saveRes = await this.authClient.post(this.url + `studentform.do`, payloadString, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrfToken
                },
                validateStatus: false
            });
            this.lastSaveStatus = saveRes.status;
            this.lastSaveHtml = typeof saveRes.data === 'string' ? saveRes.data.substring(0, 1500) : "JSON";
            // console.log(`[WebUntis] studentform.do save result: HTTP ${saveRes.status} Location: ${saveRes.headers['location']}`);
            
            if (saveRes.status === 200 && typeof saveRes.data === 'string') {
                if (saveRes.data.includes('this.setError(')) {
                     // Extract the error message for logging
                     const errorMatch = saveRes.data.match(/this\.setError\([^,]+,\s*'([^']+)'/);
                     const errorMsg = errorMatch ? errorMatch[1] : 'Unknown Validation Error';
                     throw new Error(`WebUntis validation error during save: ${errorMsg}`);
                } else {
                     console.log("[WebUntis] Body returned instead of redirect, but no explicit error found.");
                }
            }

            if (saveRes.status >= 400 && saveRes.status !== 403 && saveRes.status !== 302) {
                console.error(`WebUntis mutation failed. Status: ${saveRes.status}`);
            } else if (saveRes.status === 403) {
                throw new Error('WebUntis access denied (403). Write privileges might be missing or CSRF invalid.');
            }

            this.invalidate();

        } catch (e) {
            console.error(`WebUntis changeIdentity error for ${identity.userId}:`, e.message);
            throw e;
        }
    }
    async writeExitDates(map) {
        if (!map || Object.keys(map).length === 0) return 0;

        let client = this.authClient;
        if (!client) {
            await this.readIdentities(); // this establishes authClient
            client = this.authClient;
        }

        const exitPath = config.webuntis?.exitDate || 'setStudentExitDate.do';

        // 1. Fetch initial CSRF token from exitDate page
        const initialRes = await client.get(this.url + exitPath, { validateStatus: false });
        let htmlStr = typeof initialRes.data === 'string' ? initialRes.data : JSON.stringify(initialRes.data);

        let csrfMatch = htmlStr.match(/"csrfToken"\s*:\s*"([^"]+)"/) || htmlStr.match(/csrfToken":"([^"]+)"/);
        let currentCsrf = csrfMatch ? csrfMatch[1] : '';
        if (!currentCsrf) {
            const fallbackCsrf = htmlStr.match(/<input[^>]+type="hidden"[^>]+name="_csrf"[^>]+value="([^"]+)"/i);
            if (fallbackCsrf) currentCsrf = fallbackCsrf[1];
        }

        let updatedUsers = [];

        for (const [userId, exitDateStr] of Object.entries(map)) {
            try {
                // Step 1: Search for user on exit date form to get their selId checkbox
                const searchPayload = new URLSearchParams();
                searchPayload.append('exitDateFilter', '');
                searchPayload.append('klasseId', '-1');
                searchPayload.append('schoolyearId', '-1');
                searchPayload.append('searchString', userId);
                searchPayload.append('_studentsForDate', 'on');
                if (currentCsrf) searchPayload.append('_csrf', currentCsrf);

                const searchRes = await client.post(this.url + exitPath, searchPayload.toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': currentCsrf || ''
                    },
                    validateStatus: false
                });

                const searchHtml = typeof searchRes.data === 'string' ? searchRes.data : JSON.stringify(searchRes.data);

                const newCsrfMatch = searchHtml.match(/<input[^>]+type="hidden"[^>]+name="_csrf"[^>]+value="([^"]+)"/i);
                if (newCsrfMatch) currentCsrf = newCsrfMatch[1];

                const selIdMatch = searchHtml.match(/<input[^>]+type="checkbox"[^>]+name="selId"[^>]+value="([^"]+)"/i);

                if (!selIdMatch) {
                    console.log(`[WebUntis] No checkbox (selId) found for user ${userId}.`);
                    continue;
                }
                const selId = selIdMatch[1];

                // Step 2: Post the actual exit date
                const setPayload = new URLSearchParams();
                setPayload.append('setexitdate', '1');
                setPayload.append('exitDate', exitDateStr);
                setPayload.append('selId', selId);
                if (currentCsrf) setPayload.append('_csrf', currentCsrf);

                const setRes = await client.post(this.url + exitPath, setPayload.toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': currentCsrf || ''
                    },
                    validateStatus: false
                });

                if (setRes.status >= 200 && setRes.status < 400) {
                    updatedUsers.push(userId);
                }

                await new Promise(r => setTimeout(r, 100)); // Be gentle

            } catch (err) {
                console.error(`[WebUntis] Error setting exit date for ${userId}:`, err.message);
            }
        }

        return updatedUsers;
    }

    async readGuardians() {
        let client = this.authClient;
        if (!client) {
            await this.readIdentities(); // Establishing auth client and internalIds
            client = this.authClient;
        }

        const fetchGuardiansConfig = config.webuntis?.fetchGuardians || 'name=LegalGuardian&format=csv&elementsForDate=false&klasseId=-1&schoolyearId=-1&searchString=&exitDateFilter=0&guardianFilterTypeId=-1&context=klasseId';

        try {
            const genRes = await client.get(this.url + this.reportPath + '?' + fetchGuardiansConfig);
            if (!genRes.data || !genRes.data.data) {
                console.error('WebUntis genRes.data.data is undefined for readGuardians!', genRes.data);
                throw new Error('WebUntis did not return valid report data. Login or configuration issue possibly occurred.');
            }

            const data = genRes.data.data;
            const messageId = data.messageId;
            const reportParams = data.reportParams;

            const csv = await this._pollReport(client, messageId, reportParams, 'Guardian CSV');

            const lines = csv.split('\n');
            const guardiansMap = {};
            const guardians = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cols = parseTsvLine(line);
                if (cols.length >= 14) {
                    const id = cols[0]; // Guardian ID
                    const lastName = cols[1];
                    const firstName = cols[2];
                    const email = cols[6] ? cols[6].toLowerCase() : '';
                    const studentAccount = cols[15];
                    const studentFirstName = cols[12];
                    const studentLastName = cols[11];

                    if (!id) continue;

                    let guardian = guardiansMap[id];
                    if (!guardian) {
                        guardian = {
                            id: id,
                            email: email,
                            firstName: firstName,
                            lastName: lastName,
                            students: []
                        };
                        guardiansMap[id] = guardian;
                        guardians.push(guardian);
                    }

                    if (studentAccount) {
                        // Only add if not duplicate
                        if (!guardian.students.find(s => s.account === studentAccount)) {
                            guardian.students.push({
                                account: studentAccount,
                                firstName: studentFirstName,
                                lastName: studentLastName
                            });
                        }
                    }
                }
            }

            return guardians;

        } catch (e) {
            console.error('WebUntis readGuardians error:', e.message);
            throw new Error('WebUntis readGuardians error: ' + e.message);
        }
    }

    async changeGuardian(guardian, studentAccounts) {
        let client = this.authClient;
        if (!client || !this.internalIds) {
            await this.readIdentities(); // Establishes auth Client and populates this.internalIds
            client = this.authClient;
        }

        const addGuardianPath = config.webuntis?.addGuardian || 'legalguardianform.do';

        try {
            // Determine internal student IDs
            console.log(`[WebUntis Guardian] Processing ${guardian.email}: studentAccounts=${JSON.stringify(studentAccounts)}, internalIds keys sample: ${Object.keys(this.internalIds).slice(0, 5).join(', ')}...`);
            const studentInternalIds = [];
            for (const acc of studentAccounts) {
                const intId = this.internalIds[acc];
                if (intId) {
                    studentInternalIds.push(intId);
                    console.log(`[WebUntis Guardian]   ${acc} → internalId ${intId}`);
                } else {
                    console.warn(`[WebUntis Sync] Warning: Student account ${acc} has no internalId mapped in WebUntis. Skipping attachment. Available keys containing '${acc.substring(0, 8)}': ${Object.keys(this.internalIds).filter(k => k.includes(acc.substring(0, 8))).join(', ') || 'NONE'}`);
                }
            }
            console.log(`[WebUntis Guardian] Final relatedStudentIds for ${guardian.email}: [${studentInternalIds.join(', ')}]`);

            // Fetch CSRF token
            const indexRes = await client.get(this.url + addGuardianPath, { validateStatus: false });
            const htmlStr = typeof indexRes.data === 'string' ? indexRes.data : JSON.stringify(indexRes.data);

            let csrfMatch = htmlStr.match(/"csrfToken"\s*:\s*"([^"]+)"/) || htmlStr.match(/csrfToken":"([^"]+)"/);
            let csrfToken = csrfMatch ? csrfMatch[1] : '';
            if (!csrfToken) {
                const fallbackCsrf = htmlStr.match(/<input[^>]+type="hidden"[^>]+name="_csrf"[^>]+value="([^"]+)"/i);
                if (fallbackCsrf) csrfToken = fallbackCsrf[1];
            }

            const payload = new URLSearchParams();
            payload.append('change', 'change');
            payload.append('id', guardian.id || '-1');
            payload.append('lastUpdate', '0');
            payload.append('degree', '');
            payload.append('lastName', guardian.lastName || '');
            payload.append('firstName', guardian.firstName || '');
            payload.append('shortName', '');
            payload.append('grade', '');
            payload.append('postgrade', '');
            payload.append('externKey', '');
            payload.append('nationalId', '');
            payload.append('email', guardian.email || '');
            payload.append('phone', '');
            payload.append('mobile', '');
            payload.append('street', '');
            payload.append('postalCode', '');
            payload.append('city', '');
            payload.append('userName', '');

            for (const stId of studentInternalIds) {
                payload.append('relatedStudentIds', stId);
            }

            if (csrfToken) payload.append('_csrf', csrfToken);

            const saveRes = await client.post(this.url + addGuardianPath, payload.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrfToken || ''
                },
                validateStatus: false,
                maxRedirects: 0
            });

            if (saveRes.status >= 400 && saveRes.status !== 403 && saveRes.status !== 302) {
                console.error(`WebUntis Guardian mutation failed. Status: ${saveRes.status}`);
            } else if (saveRes.status === 403) {
                throw new Error('WebUntis Guardian access denied (403). Write privileges might be missing or CSRF invalid.');
            }

            return { success: saveRes.status < 400 || saveRes.status === 302, status: saveRes.status };

        } catch (e) {
            console.error(`WebUntis changeGuardian error for ${guardian.email}:`, e.message);
            throw e;
        }
    }
}

module.exports = new WebUntisDomain();
