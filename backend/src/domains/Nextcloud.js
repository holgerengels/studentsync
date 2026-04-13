const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const config = require('../config');

class NextcloudService {
    constructor() {
        this.config = config.nextcloud || {};
    }

    async getRemnants() {
        if (!this.config.host || !this.config.user || (!this.config.key && !this.config.passphrase)) {
            throw new Error('Nextcloud configuration is incomplete. Missing host, user, or key/passphrase.');
        }

        const ssh = new NodeSSH();
        try {
            const privateKey = fs.existsSync(this.config.key) ? fs.readFileSync(this.config.key, 'utf8') : this.config.key;
            
            await ssh.connect({
                host: this.config.host,
                port: this.config.port || 22,
                username: this.config.user,
                privateKey: privateKey,
                passphrase: this.config.passphrase
            });

            // Execute the occ command to get the remnants. Note: --json flag requires Nextcloud 19+
            const command = `sudo -S -u www-data php /var/www/nextcloud/occ ldap:show-remnants --json`;
            
            const result = await ssh.execCommand(command);
            
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
