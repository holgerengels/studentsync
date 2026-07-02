const ldap = require('ldapjs');
const Identity = require('../../domains/Identity');
const Domain = require('../../domains/Domain');
const config = require('../../config');

class VerwaltungsnetzTeacher extends Domain {
    get supportedProperties() { return ['userId', 'lastName', 'email']; }
    get cacheTTL() { return 3600000; } // 1 hour

    constructor() {
        super('verwaltungsnetz-teacher');
        const ldapConfig = config.vbsdc;

        if (!ldapConfig) {
            throw new Error('Verwaltungsnetz LDAP configuration missing (config.vbsdc)');
        }

        this.ldapUrl = ldapConfig.url;
        this.bindDN = ldapConfig.binddn;
        this.bindPW = ldapConfig.bindpw;
        this.userFilter = ldapConfig.userfilter || '(objectClass=person)';

        // baseDN: use explicit config, or derive from binddn (take DC= components)
        if (ldapConfig.basedn) {
            this.baseDN = ldapConfig.basedn;
        } else if (this.bindDN) {
            this.baseDN = this.bindDN.split(',').filter(p => /^DC=/i.test(p)).join(',');
        }
        if (!this.baseDN) throw new Error('Verwaltungsnetz LDAP baseDN could not be determined');
    }

    async readIdentities() {
        return new Promise((resolve, reject) => {
            const client = ldap.createClient({ url: this.ldapUrl });

            client.on('error', (err) => {
                reject(new Error('Verwaltungsnetz LDAP Connection Error: ' + err.message));
            });

            client.bind(this.bindDN, this.bindPW, (err) => {
                if (err) {
                    client.unbind();
                    return reject(new Error('Verwaltungsnetz LDAP Bind Error: ' + err.message));
                }

                const opts = {
                    filter: this.userFilter,
                    scope: 'sub',
                    attributes: ['initials', 'givenName', 'sn', 'mail', 'sAMAccountName']
                };

                client.search(this.baseDN, opts, (err, searchRes) => {
                    if (err) {
                        client.unbind();
                        return reject(new Error('Verwaltungsnetz LDAP Search Error: ' + err.message));
                    }

                    const identities = [];

                    searchRes.on('searchEntry', (entry) => {
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
                        if (!initials) return; // Skip entries without initials

                        const firstName = (Array.isArray(obj.givenName) ? obj.givenName[0] : obj.givenName || '').trim();
                        const lastName = (Array.isArray(obj.sn) ? obj.sn[0] : obj.sn || '').trim();
                        const email = (Array.isArray(obj.mail) ? obj.mail[0] : obj.mail || '').trim().toLowerCase();
                        const login = (Array.isArray(obj.sAMAccountName) ? obj.sAMAccountName[0] : obj.sAMAccountName || '').trim().toLowerCase();

                        identities.push(new Identity(
                            initials,
                            firstName,
                            lastName,
                            { email, login }
                        ));
                    });

                    searchRes.on('end', () => {
                        client.unbind();
                        identities.sort((a, b) => a.userId.localeCompare(b.userId));
                        resolve(identities);
                    });

                    searchRes.on('error', (err) => {
                        client.unbind();
                        reject(new Error('Verwaltungsnetz LDAP Search Stream Error: ' + err.message));
                    });
                });
            });
        });
    }
}

module.exports = new VerwaltungsnetzTeacher();
