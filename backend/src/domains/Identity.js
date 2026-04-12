class Identity {
    constructor(userId, firstName, lastName, dynamicFields = {}) {
        this.userId = userId;
        this.firstName = firstName;
        this.lastName = lastName;
        
        // Assign dynamic fields dynamically
        for (const [key, value] of Object.entries(dynamicFields)) {
            if (!this.hasOwnProperty(key) && !['userId', 'firstName', 'lastName'].includes(key)) {
                this[key] = value;
            }
        }
    }
}

module.exports = Identity;
