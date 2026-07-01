const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const config = require('../../config');
const Domain = require('../../domains/Domain');
const Identity = require('../../domains/Identity');

class NextcloudService extends Domain {
    constructor() {
        super('nextcloud');
        this.config = config.nextcloud || {};
    }

    async _connect(ssh) {
        const connectOptions = {
            host: this.config.host,
            port: this.config.port || 22,
            username: this.config.user
        };
        
        let hasAuth = false;

        let keyContent = null;
        if (this.config.key) {
            let keyPath = this.config.key;
            if (keyPath.startsWith('/config/') && !fs.existsSync('/config')) {
                const path = require('path');
                keyPath = path.join(__dirname, '../../../../config', keyPath.substring(8));
            }

            if (fs.existsSync(keyPath)) {
                keyContent = fs.readFileSync(keyPath, 'utf8');
            } else if (this.config.key.includes('PRIVATE KEY')) {
                keyContent = this.config.key;
            } else {
                console.warn(`[Nextcloud SSH] Key path configured but file not found: ${keyPath}`);
            }
        }

        if (keyContent) {
            connectOptions.privateKey = keyContent;
            if (this.config.passphrase) {
                connectOptions.passphrase = this.config.passphrase;
            }
            hasAuth = true;
        }

        if (this.config.password) {
            connectOptions.password = this.config.password;
            connectOptions.tryKeyboard = true;
            connectOptions.onKeyboardInteractive = (name, instr, instrLang, prompts, finish) => {
                if (prompts && prompts.length > 0) {
                    finish([this.config.password]);
                } else {
                    finish([]);
                }
            };
            hasAuth = true;
        }

        if (!hasAuth) {
            throw new Error('Nextcloud SSH: No authentication method configured (key or password).');
        }

        await ssh.connect(connectOptions);
    }

    async _execOcc(ssh, occCommand) {
        const sudoPassword = this.config.password || this.config.passphrase || '';
        const safePassword = sudoPassword.replace(/'/g, "'\\''");
        const command = `echo '${safePassword}' | sudo -S -u www-data php /var/www/nextcloud/occ ${occCommand}`;
        

        
        const result = await ssh.execCommand(command);

        // Bereinige den typischen sudo-S-Prompt aus stderr
        if (result.stderr) {
            result.stderr = result.stderr.replace(/\[sudo\] password for [^:]+:\s*/gi, '').trim();
        }

        return result;
    }

    async readIdentities() {
        if (!this.config.host || !this.config.user || (!this.config.key && !this.config.passphrase && !this.config.password)) {
            throw new Error('Nextcloud configuration is incomplete.');
        }

        const ssh = new NodeSSH();
        try {
            await this._connect(ssh);

            const result = await this._execOcc(ssh, 'user:list -l 0 --info --output=json');
            
            if (result.stderr && result.stderr.trim().length > 0 && !result.stdout) {
                 throw new Error('Nextcloud OCC user:list failed: ' + result.stderr.trim());
            }

            if (!result.stdout) {
                throw new Error('Nextcloud OCC user:list returned empty output. Backend may be misconfigured.');
            }

            const identities = [];
            try {
                // Nextcloud JSON for users normally looks like:
                // { "userid": { "display_name": "John Doe", "email": "john@doe.com", ... } }
                const data = JSON.parse(result.stdout);
                
                for (const [key, details] of Object.entries(data)) {
                    // Falls die Struktur anders ist und key array ist etc.
                    if (typeof details !== 'object') continue;
                    
                    const nameParts = (details.display_name || details.displayname || key).split(' ');
                    const lastName = nameParts.length > 1 ? nameParts.pop() : nameParts[0];
                    const firstName = nameParts.length > 0 ? nameParts.join(' ') : '';
                    
                    identities.push(new Identity(
                        key, 
                        firstName,
                        lastName,
                        {
                            email: details.email || details.email_address || '',
                            displayName: details.display_name || details.displayname || key
                        }
                    ));
                }
            } catch (err) {
                console.error('Failed to parse nextcloud user:list JSON:', err.message);
                
                // Fallback parsing for text output:
                // "  - userid: Display Name"
                const lines = result.stdout.split('\n');
                for (const line of lines) {
                    const match = line.match(/^  - ([^:]+): (.*)$/);
                    if (match) {
                        const uid = match[1].trim();
                        const display = match[2].trim();
                        const nameParts = display.split(' ');
                        const lastName = nameParts.length > 1 ? nameParts.pop() : nameParts[0];
                        const firstName = nameParts.length > 0 ? nameParts.join(' ') : '';
                        
                        identities.push(new Identity(
                            uid,
                            firstName,
                            lastName,
                            { displayName: display }
                        ));
                    }
                }
            }
            
            return identities;

        } catch (e) {
            // console.error('Nextcloud SSH readIdentities error:', e.message);
            throw e;
        } finally {
            ssh.dispose();
        }
    }

    async purgeRemnants(targetUids = null) {
        if (!targetUids || !Array.isArray(targetUids) || targetUids.length === 0) {
            throw new Error("Sicherheitsrichtlinie blockiert blinde Bereinigung. Es muss eine UID-Liste übergeben werden.");
        }
        
        const ssh = new NodeSSH();
        try {
            await this._connect(ssh);

            let purged = 0;
            let details = [];

            for (const uid of targetUids) {
                if (uid && typeof uid === 'string') {
                    try {
                        const result = await this._execOcc(ssh, `user:delete ${uid}`);
                        details.push({ uid, stdout: result.stdout, stderr: result.stderr });
                        purged++;
                    } catch (cmdErr) {
                        details.push({ uid, error: cmdErr.message });
                    }
                } else {
                    details.push({ error: 'Invalid uid structure', remnant: uid });
                }
            }

            return { purged, details };
        } finally {
            ssh.dispose();
        }
    }

    async getRemnants() {
        if (!this.config.host || !this.config.user || (!this.config.key && !this.config.passphrase && !this.config.password)) {
            throw new Error('Nextcloud configuration is incomplete. Missing host, user, or key/passphrase/password.');
        }

        const ssh = new NodeSSH();
        try {
            await this._connect(ssh);

            // Execute the occ command to get the remnants. Note: --json flag requires Nextcloud 19+
            const result = await this._execOcc(ssh, 'ldap:show-remnants --json');
            
            if (result.stderr && result.stderr.trim().length > 0) {
                console.error('Nextcloud OCC stderr:', result.stderr);
            }

            if (!result.stdout) {
                return [];
            }

            try {
                const remnantsData = JSON.parse(result.stdout);
                // Depending on the output structure of ldap:show-remnants --json, we return the parsed array
                // The JSON from occ might be formatted in a specific way
                return typeof remnantsData === 'object' && !Array.isArray(remnantsData) && remnantsData.data ? remnantsData.data : Object.values(remnantsData);
            } catch (err) {
                console.error('Failed to parse nextcloud remnants JSON:', err);
                console.error('Raw output:', result.stdout);
                
                // Fallback text parser if JSON is not standard
                const lines = result.stdout.split('\n');
                const users = [];
                for (const line of lines) {
                    // Usually lines like `| UserID | DisplayName | ...`
                    // We extract just basic text matching if it crashes
                    if (line.includes('|') && !line.includes('+--')) {
                        const parts = line.split('|').map(s => s.trim()).filter(Boolean);
                        if (parts.length > 0 && parts[0] !== 'ownCloud name') {
                            users.push({
                                account: parts[0],
                                displayName: parts[1] || parts[0],
                                details: parts.join(', ')
                            });
                        }
                    }
                }
                return users;
            }

        } catch (e) {
            console.error('Nextcloud SSH connection error:', e.message);
            throw e;
        } finally {
            ssh.dispose();
        }
    }
}

module.exports = new NextcloudService();
