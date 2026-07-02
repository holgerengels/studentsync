const MatrixDomain = require('../../domains/MatrixDomain');
const Identity = require('../../domains/Identity');
const { getDomain } = require('../../domains/registry');

class MatrixTeacher extends MatrixDomain {
    constructor() {
        super('matrix-teacher', 'teachers');
        this.loginToInitials = new Map();
        this.initialsToLogin = new Map();
    }

    async initFilter() {
        this.loginToInitials.clear();
        this.initialsToLogin.clear();
        try {
            const skTeacher = getDomain('schulkonsole-teacher');
            if (skTeacher) {
                const skIdentities = await skTeacher.getIdentities();
                for (const ident of skIdentities) {
                    if (ident.login && ident.userId) {
                        const loginLower = ident.login.toLowerCase();
                        this.loginToInitials.set(loginLower, ident.userId);
                        this.initialsToLogin.set(ident.userId.toLowerCase(), ident.login);
                    }
                }
            }
        } catch (e) {
            console.warn(`[Matrix Teacher Domain] Could not load teacher logins from Schulkonsole for mapping: ${e.message}`);
        }
    }

    mapIdentity(username, firstName, lastName) {
        const initials = this.loginToInitials.get(username.toLowerCase());
        if (!initials) return null;

        return new Identity(
            initials,
            firstName,
            lastName,
            {
                login: username
            }
        );
    }
}

module.exports = new MatrixTeacher();
