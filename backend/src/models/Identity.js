/**
 * Unified Identity Model
 * Replaces the old Student, Teacher, and Guardian classes with a single representation.
 */
class Identity {
    constructor({
        id, // System-independent unique identifier
        account, // Login account name
        firstName,
        lastName,
        gender,
        birthday,
        eMail,
        clazz, // Primary class/group association
        roles = [], // e.g. ['student'], ['teacher'], ['guardian']
        courses = [],
        properties = {} // Additional system-specific data
    }) {
        this.id = id || account;
        this.account = account;
        this.firstName = firstName;
        this.lastName = lastName;
        this.gender = gender;
        this.birthday = birthday; // YYYY-MM-DD
        this.eMail = eMail;
        this.clazz = clazz;
        this.roles = roles;
        this.courses = courses;
        this.properties = properties;
    }

    // Generate a hash or standard string for diffing
    getDiffHash() {
        return JSON.stringify({
            account: this.account,
            firstName: this.firstName,
            lastName: this.lastName,
            gender: this.gender,
            birthday: this.birthday,
            clazz: this.clazz
        });
    }
}

module.exports = Identity;
