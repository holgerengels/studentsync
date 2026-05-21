const firstNames = ['Leon', 'Lukas', 'Finn', 'Paul', 'Jonas', 'Ben', 'Felix', 'Elias', 'Maximilian', 'Tim', 'Mia', 'Emma', 'Hannah', 'Lea', 'Sofia', 'Anna', 'Lena', 'Lina', 'Marie', 'Mila', 'Noah', 'David', 'Julian', 'Moritz', 'Emil'];
const lastNames = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Hofmann', 'Krüger', 'Vogel', 'Fuchs'];

const baseUsers = [];
for (let i = 0; i < 25; i++) {
    const fName = firstNames[i];
    const lName = lastNames[i];
    let account = `${lName.toLowerCase().substring(0, 5)}_${fName.toLowerCase().substring(0, 2)}`;
    // handle umlauts
    account = account.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    let kuerzel = `${lName.substring(0, 2)}${fName.substring(0, 1)}`.toLowerCase();
    const clazz = i < 10 ? '10A' : (i < 20 ? '10B' : '11C');

    baseUsers.push({
        id: `asv_internal_${i}`, // simulate internal DB ID
        userId: account,
        account: account,
        kuerzel: kuerzel,
        firstName: fName,
        lastName: lName,
        clazz: clazz,
        birthday: `200${(i % 5) + 5}-01-01` // e.g. 2005-01-01
    });
}

// User 0 has no account yet (will trigger ID generation in ASV)
const asvData = baseUsers.map((u, i) => {
    if (i === 0) {
        return { ...u, userId: null, account: null };
    }
    return { ...u };
});

// Untis misses user 1 (will be added by Sync)
const untisData = baseUsers.filter((_, i) => i !== 1 && i !== 0).map(u => ({ ...u }));

// Nextcloud misses user 2, but has an old remnant
const nextcloudData = baseUsers.filter((_, i) => i !== 2 && i !== 0).map(u => ({
    ...u,
    email: `${u.account}@schule.local`
}));
nextcloudData.push({
    userId: 'ghost_us',
    account: 'ghost_us',
    firstName: 'Ghost',
    lastName: 'User',
    email: 'ghost@schule.local'
});

// Schulkonsole has a wrong class for user 3
const schulkonsoleData = baseUsers.filter((_, i) => i !== 0).map((u, i) => {
    if (i === 3) return { ...u, clazz: '99Z' };
    return { ...u };
});

const webuntisData = baseUsers.filter((_, i) => i !== 0).map(u => ({ ...u }));

module.exports = {
    asvData,
    untisData,
    schulkonsoleData,
    nextcloudData,
    webuntisData,
    baseUsers
};
