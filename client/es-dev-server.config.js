const proxy = require('koa-proxies');

module.exports = {
  port: 8000,
  middlewares: [
    proxy('/server', {
      target: 'http://localhost:8080',
    }),
  ],
};
