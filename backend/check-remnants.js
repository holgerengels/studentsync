const { domains } = require('./src/domains/index');

async function checkOverlappingRemnants() {
    try {
        const nextcloud = domains.nextcloud;
        const asv = domains.asv;

        console.log('Rufe Nextcloud Remnants ab...');
        const remnants = await nextcloud.getRemnants();
        console.log(`-> ${remnants.length} Remnants in Nextcloud gefunden.\n`);

        console.log('Rufe ASV Identitäten ab...');
        const asvIdentities = await asv.getIdentities();
        console.log(`-> ${asvIdentities.length} Identitäten in ASV gefunden.\n`);

        // Erstelle zur schnelleren Prüfung ein Set aller ASV Accountnamen (kleingeschrieben)
        const asvAccounts = new Set(asvIdentities.map(id => (id.account || "").toLowerCase()));

        const overlapping = [];

        // Prüfe jeden Remnant, ob seine UID noch in der ASV als Account existiert
        for (const rem of remnants) {
            const uid = rem.ocName || rem.account || rem.uid || (typeof rem === 'string' ? rem : null);
            if (uid && asvAccounts.has(uid.toLowerCase())) {
                overlapping.push(rem);
            }
        }

        console.log('====================================================');
        console.log(`ERGEBNIS: ${overlapping.length} Remnants gefunden, die noch in ASV existieren!`);
        console.log('====================================================');
        
        overlapping.forEach(rem => {
            const uid = rem.ocName || rem.account || rem.uid || (typeof rem === 'string' ? rem : 'Unbekannt');
            const display = rem.displayName || rem.displayname || rem.name || '';
            console.log(` - UID: ${uid.padEnd(20)} | Name: ${display}`);
        });

        process.exit(0);
    } catch (e) {
        console.error('Fehler während der Prüfung:', e);
        process.exit(1);
    }
}

checkOverlappingRemnants();
