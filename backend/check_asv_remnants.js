const nextcloud = require('./src/domains/Nextcloud');
const asv = require('./src/domains/ASV');
const mongoose = require('mongoose');
const config = require('./src/config');

async function run() {
    try {
        console.log('Connecting to Mongo...');
        await mongoose.connect(config.mongodb?.uri || 'mongodb://localhost:27017/synx_logs');
        
        console.log('Fetching Nextcloud Remnants...');
        const rawRemnants = await nextcloud.getRemnants();
        const remnantsIds = rawRemnants.map(rem => (rem.ocName || rem.account || rem.uid || (typeof rem === 'string' ? rem : '')).toLowerCase());
        console.log(`Found ${remnantsIds.length} remnants in Nextcloud.`);

        console.log('Fetching ASV Identities...');
        const asvIdentities = await asv.readIdentities();
        const asvIds = asvIdentities.map(id => id.userId.toLowerCase());
        console.log(`Found ${asvIds.length} ASV identities.`);

        console.log('Cross-referencing...');
        const overlap = [];
        for (const remId of remnantsIds) {
            if (!remId) continue;
            if (asvIds.includes(remId)) {
                overlap.push(remId);
            }
        }

        console.log('\n--- RESULTS ---');
        console.log(`Found ${overlap.length} remnants that are STILL in ASV!`);
        if (overlap.length > 0) {
            console.log(overlap.join(', '));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();
