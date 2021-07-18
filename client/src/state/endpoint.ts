export const endpoint = {
  path: "/server/",
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
  list(domain): RequestInfo {
    return this.path + `list?domain=${domain}`;
  },
  filter(domain, search): RequestInfo {
    return this.path + `list?domain=${domain}&search=${search}`;
  },
  diff(master, slave): RequestInfo {
    return this.path + `diff?master=${master}&slave=${slave}`;
  },
  sync(master, slave): RequestInfo {
    return this.path + `sync?master=${master}&slave=${slave}`;
  },
  task(name): RequestInfo {
    return this.path + `task?task=${name}`;
  },
  settings(action): RequestInfo {
    return this.path + `settings?action=${action}`;
  }
};
