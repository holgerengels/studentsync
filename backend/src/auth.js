const jwt = require('jsonwebtoken');
const ldap = require('ldapjs');
const fs = require('fs');

const escapeLDAP = (str) => {
    if (!str) return '';
    return str.replace(/[\*\(\)\\\0]/g, function (char) {
        switch (char) {
            case '*': return '\\2a';
            case '(': return '\\28';
            case ')': return '\\29';
            case '\\': return '\\5c';
            case '\0': return '\\00';
            default: return char;
        }
    });
};

// Load Config
const config = require('./config');
const settings = config.settings || {};

console.log(`[Auth] Settings loaded. DevMode: ${settings.devmode}`);

const MOCK_USERS = [
    { username: 'admin', password: 'password', groups: ['Administration'], displayName: 'Holger Engels' },
    { username: 'lehrer1', password: 'password', groups: ['Lehrkräfte'], displayName: 'Max Mustermann' },
    { username: 'schulleiter', password: 'password', groups: ['Schulleitung', 'Lehrkräfte'], displayName: 'Thomas Braun' }
];

const SECRET_KEY = 'supersecretkey_synx'; // Use ENV in production
const REFRESH_SECRET_KEY = 'supersecretrefreshkey_synx'; 
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = (settings.server && settings.server.refreshTokenExpiry) || '30d';

const login = async (username, password, isPwa = true) => {
    username = username.toLowerCase();
    
    // 1. DevMode Check
    if (settings.devMode !== false && (!settings.server || !settings.server.ldap)) {
        const user = MOCK_USERS.find(u => u.username === username && u.password === password);
        if (user) {
            console.log(`[Auth] Mock login successful for ${username}`);
            const token = jwt.sign({ username: user.username, groups: user.groups }, SECRET_KEY, { expiresIn: ACCESS_TOKEN_EXPIRY });
            const result = { token, user: { username: user.username, groups: user.groups, displayName: user.displayName } };
            if (isPwa) result.refreshToken = generateRefreshToken(user.username, user.groups);
            return result;
        }
        return null;
    }

    // 2. LDAP Auth
    if (!settings.server || !settings.server.ldap) {
        console.error('[Auth] LDAP settings missing');
        return null;
    }

    const ldapConfig = settings.server.ldap;

    return new Promise((resolve) => {
        const client = ldap.createClient({ url: ldapConfig.url });

        client.on('error', (err) => {
            console.error('[Auth] LDAP Client Error:', err);
            resolve(null);
        });

        client.bind(ldapConfig.binddn, ldapConfig.bindpw, (err) => {
            if (err) {
                console.error('[Auth] LDAP Bind Error:', err);
                client.unbind();
                return resolve(null);
            }

            const escapedUsername = escapeLDAP(username);
            const filter = `(&${ldapConfig.userfilter}(sAMAccountName=${escapedUsername}))`;
            const opts = { filter, scope: 'sub', attributes: ['dn', 'memberOf', 'givenName', 'sn'] };

            client.search(ldapConfig.basedn, opts, (err, searchRes) => {
                if (err) {
                    client.unbind(); return resolve(null);
                }

                let userEntry = null;

                searchRes.on('searchEntry', (entry) => {
                    userEntry = entry.object;
                });

                searchRes.on('end', (result) => {
                    if (result.status !== 0 || !userEntry) {
                        client.unbind(); return resolve(null);
                    }

                    const userClient = ldap.createClient({ url: ldapConfig.url });
                    userClient.bind(userEntry.dn, password, (err) => {
                        if (err) {
                            userClient.unbind(); client.unbind(); return resolve(null);
                        }

                        userClient.unbind(); client.unbind();

                        const groups = [];
                        const rawGroups = Array.isArray(userEntry.memberOf) ? userEntry.memberOf : [userEntry.memberOf];
                        const prefix = ldapConfig.groupprefix || '';

                        if (rawGroups) {
                            rawGroups.forEach(groupDn => {
                                if (!groupDn) return;
                                const match = groupDn.match(/^CN=([^,]+)/i);
                                if (match) {
                                    const cn = match[1];
                                    if (cn.startsWith(prefix)) groups.push(cn.substring(prefix.length));
                                }
                            });
                        }
                        
                        let givenName = userEntry.givenName || '';
                        let sn = userEntry.sn || '';
                        if (Array.isArray(givenName)) givenName = givenName[0];
                        if (Array.isArray(sn)) sn = sn[0];
                        const displayName = [givenName, sn].filter(Boolean).join(' ') || username;

                        const token = jwt.sign({ username: username, groups: groups }, SECRET_KEY, { expiresIn: ACCESS_TOKEN_EXPIRY });
                        const resObj = { token, user: { username, groups, displayName } };
                        if (isPwa) resObj.refreshToken = generateRefreshToken(username, groups);
                        resolve(resObj);
                    });
                });

                searchRes.on('error', () => { client.unbind(); resolve(null); });
            });
        });
    });
};

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token.split(' ')[1], SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Failed to authenticate token' });
        req.user = decoded;
        next();
    });
};

const generateRefreshToken = (username, groups) => {
    return jwt.sign({ username, groups, type: 'refresh' }, REFRESH_SECRET_KEY, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

const refreshAccessToken = (refreshToken) => {
    try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET_KEY);
        if (decoded.type !== 'refresh') return null;
        
        const newAccessToken = jwt.sign(
            { username: decoded.username, groups: decoded.groups },
            SECRET_KEY,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );
        return { token: newAccessToken, user: { username: decoded.username, groups: decoded.groups } };
    } catch (err) {
        return null;
    }
};

module.exports = { login, verifyToken, refreshAccessToken };
