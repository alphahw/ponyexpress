const CONFIG = require('./config.json');
const ENV_CONFIG = process.env;

Object.keys(CONFIG).map((key) => {
  let _key = key.replace(/([A-Z])/g, function($1) { return '_' + $1; }).toUpperCase();
  if (_key in ENV_CONFIG) {
    CONFIG[key] = (Number.isNaN(ENV_CONFIG[_key] * 1) ?
      ENV_CONFIG[_key] :
      Number(ENV_CONFIG[_key])
    );
  }
});

if (!CONFIG.port ||
  !CONFIG.hashedSocketToken ||
  !CONFIG.postTokenPath ||
  !CONFIG.hashedPostToken ||
  !CONFIG.resDefaultPayload ||
  !CONFIG.resTimeout) {
  throw new Error('Please ensure your config is complete; see config.SAMLPLE.json for an example. If passing env vars, still include the prop in your JSON config.');
}

const Hapi = require('hapi');
const Boom = require('boom');

const server = new Hapi.Server();
server.connection({
  port: CONFIG.port,
});

const io = require('socket.io')(server.listener);

const crypto = require('crypto');
function hash() { return crypto.createHash('sha256'); };

let reqId;
let resPromise;

Object.resolve = (obj, path) => {
  return path.split('.').reduce((prev, curr) => {
    return prev ? prev[curr] : undefined
  }, obj || self)
}

function defer() {
  let res;
  let rej;

  let promise = new Promise((resolve, reject) => {
    res = resolve;
    rej = reject;
  });

  promise.resolve = res;
  promise.reject = rej;

  return promise;
}

io.on('connection', (socket) => {
  socket.authed = false;

  socket.on('auth', (socketToken) => {
    let hashedSocketToken = socketToken ?
      hash().update(socketToken).digest('hex') :
      null;

    if (hashedSocketToken && hashedSocketToken == CONFIG.hashedSocketToken) {
      socket.authed = true;
      socket.join('authed');
    } else {
      socket.disconnect(true);
    }
  });

  socket.on('res', (data, goneCallback) => {
    if (!socket.authed) return;

    if (resPromise && reqId && data.id == reqId) {
      resPromise.resolve(data.payload);
    } else {
      goneCallback(data);
    }
  });

  socket.on('disconnect', () => {
  });
});

server.route({
  method: 'POST',
  path: '/',
  handler: (req, res) => {
    let resError = Boom.unauthorized();
    let postToken = Object.resolve(req, CONFIG.postTokenPath);
    let hashedPostToken = postToken ?
      hash().update(postToken).digest('hex') :
      null;

    if (hashedPostToken && hashedPostToken == CONFIG.hashedPostToken) {
      reqId = req.id;
      io.to('authed').emit('POST', {
        headers: req.headers,
        id: req.id,
        info: req.info,
        method: req.method,
        mime: req.mime,
        payload: req.payload
      });

      resPromise = defer();
      resError = null;

      setTimeout(() => {
        if (resPromise) resPromise.resolve(CONFIG.resDefaultPayload);
      }, CONFIG.resTimeout);
    }

    if (resPromise) {
      resPromise.then((resPayload) => {
        reqId = null;
        resPromise = null;
        res(resError, resPayload);
      });
    } else {
      // Respond straight away if no promise
      res(resError);
    }
  }
});

server.start();