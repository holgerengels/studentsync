const domains = new Map();

function registerDomain(domainObj) {
    domains.set(domainObj.domainName, domainObj);
}

function getDomain(name) {
    return domains.get(name);
}

function getAllDomains() {
    return Array.from(domains.values());
}

function clearRegistry() {
    domains.clear();
}

module.exports = { registerDomain, getDomain, getAllDomains, clearRegistry };
