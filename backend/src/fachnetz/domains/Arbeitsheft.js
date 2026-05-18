const axios = require('axios');
const ManagableDomain = require('../../domains/ManagableDomain');
const Identity = require('../../domains/Identity');
const config = require('../../config');

/**
 * Arbeitsheft domain — reads/writes teacher profiles from the XWiki-based Mathe-Arbeitsheft platform.
 * Uses XWiki REST API with Basic Auth.
 * Extends ManagableDomain to support the generic DiffTask/SyncTask infrastructure.
 */
class Arbeitsheft extends ManagableDomain {
    get supportedProperties() { return ['userId', 'firstName', 'lastName', 'email', 'schulname', 'schulort']; }
    get cacheTTL() { return 3600000; } // 1 hour

    constructor() {
        super('arbeitsheft');
        const c = config.xwiki || {};
        this.url = c.url;
        this.user = c.user;
        this.password = c.password;
        this.restPath = c.rest || 'rest';

        if (!this.url || !this.user || !this.password) {
            throw new Error('Arbeitsheft (XWiki) configuration is incomplete. Missing url, user, or password.');
        }
        if (!this.url.endsWith('/')) this.url += '/';
        if (this.restPath.startsWith('/')) this.restPath = this.restPath.substring(1);
        if (!this.restPath.endsWith('/')) this.restPath += '/';

        this.axiosConfig = {
            auth: {
                username: this.user,
                password: this.password
            }
        };
    }

    async readIdentities() {
        const params = new URLSearchParams({
            outputSyntax: 'plain',
            classname: 'XWiki.XWikiUsers',
            collist: 'doc.name,first_name,last_name,email,schule,schulort,rp',
            queryFilters: 'currentlanguage,hidden',
            hideDisabledProfiles: 'true',
            offset: '1',
            limit: '1000',
            sort: 'last_name',
            dir: 'asc'
        });
        const queryUrl = this.url + 'bin/get/XWiki/UserDirectoryLivetableResults?' + params.toString();

        const res = await axios.get(queryUrl, {
            ...this.axiosConfig,
            headers: {
                'Accept': 'application/json'
            },
            timeout: 30000
        });

        const rows = res.data.rows || [];
        console.log(`[Arbeitsheft] Loaded ${rows.length} / ${res.data.totalrows} users via LiveTable`);

        return rows.map(r => new Identity(
            r.doc_name,
            r.first_name_value || '',
            r.last_name_value || '',
            {
                domain: 'arbeitsheft',
                id: r.doc_name,
                email: r.email_value || '',
                schulname: r.schule_value || '',
                schulort: r.schulort_value || '',
                rp: r.rp_value || ''
            }
        ));
    }

    async _fetchProfileDetails(pageName) {
        const detailUrl = this.url + this.restPath
            + 'wikis/xwiki/spaces/XWiki/pages/' + pageName + '/objects/XWiki.XWikiUsers/0';

        try {
            const res = await axios.get(detailUrl, {
                ...this.axiosConfig,
                headers: {
                    'Accept': 'application/json'
                },
                timeout: 15000
            });

            const properties = res.data.properties || [];
            const fields = {};

            for (const prop of properties) {
                const name = prop.name;
                const value = (prop.value === null || prop.value === undefined) ? '' : String(prop.value);

                if (['email', 'first_name', 'last_name', 'schule', 'schulort', 'rp'].includes(name)) {
                    fields[name] = value;
                }
            }

            return new Identity(
                pageName,
                fields.first_name || '',
                fields.last_name || '',
                {
                    domain: 'arbeitsheft',
                    id: pageName,
                    email: fields.email || '',
                    schulname: fields.schule || '',
                    schulort: fields.schulort || '',
                    rp: fields.rp || ''
                }
            );
        } catch (e) {
            console.error(`[Arbeitsheft] Error fetching details for ${pageName}: ${e.message}`);
            return null;
        }
    }

    /**
     * Update a profile in XWiki via PUT to the REST API.
     * Called by the generic SyncTask via changeIdentity().
     */
    async changeIdentity(identity) {
        const putUrl = this.url + this.restPath
            + 'wikis/xwiki/spaces/XWiki/pages/' + encodeURIComponent(identity.userId)
            + '/objects/XWiki.XWikiUsers/0';

        const escapeXml = (s) => (s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const xmlPayload = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<object xmlns="http://www.xwiki.org">
  <className>XWiki.XWikiUsers</className>
  <property name="first_name"><value>${escapeXml(identity.firstName)}</value></property>
  <property name="last_name"><value>${escapeXml(identity.lastName)}</value></property>
  <property name="email"><value>${escapeXml(identity.email)}</value></property>
  <property name="schule"><value>${escapeXml(identity.schulname)}</value></property>
  <property name="schulort"><value>${escapeXml(identity.schulort)}</value></property>
</object>`;

        const res = await axios.put(putUrl, xmlPayload, {
            ...this.axiosConfig,
            headers: {
                'Accept': 'application/xml',
                'Content-Type': 'application/xml'
            },
            timeout: 15000,
            validateStatus: false
        });

        if (res.status < 200 || res.status >= 300) {
            throw new Error(`XWiki PUT failed for ${identity.userId}: HTTP ${res.status}`);
        }

        this.invalidate();
    }
}

module.exports = new Arbeitsheft();
