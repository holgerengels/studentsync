export const endpoint = {
    path: "http://localhost:8081/server/",
    get: {
        method: "GET",
        mode: "cors",
        cache: "no-cache",
        credentials: "include",
        headers: new Headers({ "Content-Type": "application/json; charset=utf-8" })
    },
    post: {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        credentials: "include",
        headers: new Headers({ "Content-Type": "application/json; charset=utf-8" })
    },
    list(domain) {
        return this.path + `list?domain=${domain}`;
    },
    filter(domain, search) {
        return this.path + `list?domain=${domain}&search=${search}`;
    },
    diff(master, slave) {
        return this.path + `diff?master=${master}&slave=${slave}`;
    },
    sync(master, slave) {
        return this.path + `sync?master=${master}&slave=${slave}`;
    },
    task(name) {
        return this.path + `task?task=${name}`;
    },
    settings(action) {
        return this.path + `settings?action=${action}`;
    }
};
//# sourceMappingURL=endpoint.js.map