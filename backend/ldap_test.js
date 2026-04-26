const ldap = require('ldapjs');
const client = ldap.createClient({ url: 'ldap://localhost:3389' });
client.bind('CN=ldapbinduser,CN=Users,DC=verwaltung,DC=local', 'Q8rksp1se!%1755', (err) => {
    if (err) { console.error('Bind Error:', err); client.unbind(); return; }
    console.log('Bind successful!');
    const opts = { filter: '(&(objectclass=person)(sAMAccountName=holger_engels))', scope: 'sub', attributes: ['dn', 'sAMAccountName'] };
    client.search('DC=verwaltung,DC=local', opts, (err, res) => {
        if (err) { console.error('Search Error:', err); client.unbind(); return; }
        let count = 0;
        res.on('searchEntry', (entry) => {
            console.log('Found:', entry.object);
            count++;
        });
        res.on('end', (result) => {
            console.log('Search end. Status:', result.status, 'Count:', count);
            client.unbind();
        });
        res.on('error', (err) => { console.error('Stream Error:', err); client.unbind(); });
    });
});
