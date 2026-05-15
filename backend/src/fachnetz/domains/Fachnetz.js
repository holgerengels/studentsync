const axios = require('axios');
const cheerio = require('cheerio');
const Domain = require('../../domains/Domain');
const Identity = require('../../domains/Identity');
const config = require('../../config');

/**
 * Fachnetz domain — reads teacher profiles from the Moodle-based Fachnetz platform.
 * Uses HTML scraping: login → session key → report download → parse HTML table.
 * Read-only domain (not managable).
 */
class Fachnetz extends Domain {
    get supportedProperties() { return ['userId', 'firstName', 'lastName', 'email', 'schulname', 'schulort', 'rp']; }
    get cacheTTL() { return 3600000; } // 1 hour

    constructor() {
        super('fachnetz');
        const c = config.moodle || {};
        this.url = c.url;
        this.user = c.user;
        this.password = c.password;
        this.loginPath = c.plogin || 'login/index.php';
        this.userPath = c.puser || 'admin/user.php';
        this.reportPath = c.preport || 'reportbuilder/download.php';

        if (!this.url || !this.user || !this.password) {
            throw new Error('Fachnetz (Moodle) configuration is incomplete. Missing url, user, or password.');
        }
        if (!this.url.endsWith('/')) this.url += '/';
    }

    async readIdentities() {
        // Use axios with cookie jar support for session handling
        const { wrapper } = require('axios-cookiejar-support');
        const { CookieJar } = require('tough-cookie');

        const jar = new CookieJar();
        const client = wrapper(axios.create({ jar, timeout: 30000 }));

        // Step 1: GET login page to extract logintoken
        const loginPageRes = await client.get(this.url + this.loginPath, { validateStatus: false });
        const $ = cheerio.load(loginPageRes.data);
        const logintoken = $('input[name="logintoken"]').attr('value');

        // Step 2: POST login
        const loginParams = new URLSearchParams();
        loginParams.append('username', this.user);
        loginParams.append('password', this.password);
        if (logintoken) loginParams.append('logintoken', logintoken);

        await client.post(this.url + this.loginPath, loginParams, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            maxRedirects: 5,
            validateStatus: false
        });

        // Step 3: GET user page to extract sesskey
        const userPageRes = await client.get(this.url + this.userPath, { validateStatus: false });
        const $user = cheerio.load(userPageRes.data);
        const sesskey = $user('input[name="sesskey"]').attr('value');
        if (!sesskey) {
            throw new Error('Fachnetz: Could not extract sesskey. Login may have failed.');
        }

        // Step 4: Download report (HTML format)
        const reportUrl = this.url + this.reportPath
            + '?id=26&download=html&parameters=%7B%22withcheckboxes%22%3Atrue%7D&sesskey=' + sesskey;
        const reportRes = await client.get(reportUrl, { validateStatus: false });

        if (reportRes.status !== 200) {
            throw new Error(`Fachnetz: Report download failed with status ${reportRes.status}`);
        }

        // Step 5: Parse HTML table
        const $report = cheerio.load(reportRes.data);
        const identities = [];

        $report('tr').each((i, row) => {
            if (i === 0) return; // skip header
            const cols = $report(row).children('td');
            if (cols.length < 7) return;

            const anmeldename = $report(cols[0]).text().trim();
            const email = $report(cols[1]).text().trim();
            const vorname = $report(cols[2]).text().trim();
            const nachname = $report(cols[3]).text().trim();
            const schulname = $report(cols[4]).text().trim();
            const schulort = $report(cols[5]).text().trim();
            const rp = $report(cols[6]).text().trim();

            // Extract ID from link in column 8 if present
            let moodleId = null;
            const link = $report(cols[7]).find('a').attr('href');
            if (link && link.includes('id=')) {
                moodleId = link.split('id=').pop();
            }

            if (anmeldename) {
                identities.push(new Identity(
                    anmeldename,
                    vorname,
                    nachname,
                    {
                        domain: 'fachnetz',
                        id: moodleId || anmeldename,
                        email,
                        schulname,
                        schulort,
                        rp
                    }
                ));
            }
        });

        return identities.sort((a, b) => (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName));
    }
}

module.exports = new Fachnetz();
