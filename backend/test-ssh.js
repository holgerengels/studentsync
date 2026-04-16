const { NodeSSH } = require('node-ssh');
const config = require('./src/config');
const fs = require('fs');

async function t() {
    const nc = config.nextcloud;
    const ssh = new NodeSSH();
    let hasAuth = false;
    const connectOptions = {
        host: nc.host,
        port: nc.port || 22,
        username: nc.user
    };
    
    if (nc.key) {
        connectOptions.privateKey = fs.existsSync(nc.key) ? fs.readFileSync(nc.key, 'utf8') : nc.key;
        if (nc.passphrase) connectOptions.passphrase = nc.passphrase;
        hasAuth = true;
    }
    if (nc.password) {
        connectOptions.password = nc.password;
        connectOptions.tryKeyboard = true;
        connectOptions.onKeyboardInteractive = (n, i, il, p, f) => f([nc.password]);
        hasAuth = true;
    }

    try {
        await ssh.connect(connectOptions);
        console.log('Connected! Testing sudo -S');
        const sudoPassword = nc.password || nc.passphrase || "";
        const safePassword = sudoPassword.replace(/'/g, "'\\''");
        
        // 1. Try simple echo | sudo
        const cmd1 = `echo '${safePassword}' | sudo -S -u www-data php /var/www/nextcloud/occ help ldap:show-remnants`;
        console.log('running:', cmd1.replace(safePassword, '***'));
        const r1 = await ssh.execCommand(cmd1);
        console.log('r1 stdout:', r1.stdout);
        console.log('r1 stderr:', r1.stderr);

    } catch(e) {
        console.error('fail:', e.message);
    } finally {
        ssh.dispose();
    }
}
t();
