function call(command, callback) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return callback(new Error('KV variables are missing from this deployment'));
  var called = false;
  function done(err, value) { if (called) return; called = true; callback(err, value); }
  var https = require('https'), parsed = require('url').parse(process.env.KV_REST_API_URL.replace(/\/$/, '') + '/' + command.map(encodeURIComponent).join('/'));
  var req = https.request({ protocol: parsed.protocol, hostname: parsed.hostname, port: parsed.port, path: parsed.path, method: 'GET', headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN } }, function (res) {
    var chunks = [];
    res.on('data', function (c) { chunks.push(c); });
    res.on('end', function () {
      var text = Buffer.concat(chunks).toString('utf8'), data;
      try { data = JSON.parse(text); } catch (e) { return done(new Error('KV returned a non-JSON response')); }
      done(res.statusCode >= 200 && res.statusCode < 300 ? null : new Error('KV returned HTTP ' + res.statusCode), data.result);
    });
    res.on('error', function () { done(new Error('KV response failed')); });
    res.on('aborted', function () { done(new Error('KV response aborted')); });
  });
  req.on('error', function () { done(new Error('KV connection failed')); });
  req.setTimeout(3000, function () { req.destroy(new Error('KV request timed out')); });
  req.end();
}
function kvSet(key, value, seconds, cb) { call(['set', key, JSON.stringify(value), 'EX', seconds], cb); }
function kvGet(key, cb) { call(['get', key], function (err, value) { if (err || !value) return cb(err, null); try { cb(null, JSON.parse(value)); } catch (e) { cb(e); } }); }
function kvDel(key, cb) { call(['del', key], cb); }
function kvIncr(key, seconds, cb) { call(['incr', key], function (err, value) { if (err) return cb(err); if (String(value) === '1') call(['expire', key, seconds], function (expireErr) { cb(expireErr, value); }); else cb(null, value); }); }
module.exports = { kvSet: kvSet, kvGet: kvGet, kvDel: kvDel, kvIncr: kvIncr };
