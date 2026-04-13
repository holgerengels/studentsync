const WebUntisRest = require('./domains/WebUntisRest');

// Fetch base config properties from default.json, but override the URL 
// to be strictly vu.webuntis.com as requested by the user.
let baseConfig;
try {
    baseConfig = require('../../config/default.json').webuntis;
} catch (e) {
    baseConfig = {
        user: process.env.WEBUNTIS_USER,
        password: process.env.WEBUNTIS_PASSWORD,
        secret: process.env.WEBUNTIS_SECRET
    };
}

const config = { 
    ...baseConfig, 
    url: 'https://vu.webuntis.com/WebUntis' 
};

// Instantiate the new REST domain
const untis = new WebUntisRest(config);

async function testRestStudentUpdate() {
    console.log("==================================================");
    console.log(" WebUntis REST Update Test (Tester_Schüler)       ");
    console.log(" URL: " + config.url);
    console.log("==================================================");

    try {
        console.log("Fetching identities from WebUntis (via GET Form Scrape)...");
        const identities = await untis.readIdentities();
        
        // Find our test student
        const student = identities.find(i => i.userId === 'Tester_Schüler' || i.lastName === 'Tester_Schüler');
        if (!student) {
            console.error("Student 'Tester_Schüler' not found in WebUntis.");
            process.exit(1);
        }

        console.log("\nFound Test Student:");
        console.log(`  Name:     ${student.firstName} ${student.lastName}`);
        console.log(`  ID:       ${student.userId}`);
        console.log(`  Birthday: ${student.birthday}`);
        console.log(`  Majority: ${student.majority}`);

        // Toggle majority for test
        const newMajorityState = !student.majority;
        console.log(`\nAttempting to save student via REST... (Setting majority = ${newMajorityState})`);
        
        student.majority = newMajorityState; 

        await untis.changeIdentity(student);

        console.log("\nSave operation via REST completed successfully.");
        console.log(`Status recorded internally: ${untis.lastSaveStatus}`);

    } catch (e) {
        console.error("\nError during execution:", e);
    } finally {
        process.exit(0);
    }
}

testRestStudentUpdate();
