var test = require('node:test');
var assert = require('node:assert');
var path = require('node:path');
var helpers = require('./helpers');

var lib = require(path.join('..', 'api', '_lib.js'));
var searchArtist = require(path.join('..', 'api', 'spotify', 'search-artist.js'));

function stubLib(overrides) {
  var originals = {};
  Object.keys(overrides).forEach(function (key) { originals[key] = lib[key]; lib[key] = overrides[key]; });
  return function restore() { Object.keys(originals).forEach(function (key) { lib[key] = originals[key]; }); };
}

function validSession(key, cb) { cb(null, { refresh_token: 'refresh-token' }); }
function validToken(cfg, body, cb) { cb(null, 200, { access_token: 'access-token' }); }

test('rejects non-GET requests with 405', function () {
  var res = helpers.fakeRes();
  searchArtist(helpers.fakeReq('POST', '/api/spotify/search-artist'), res);
  assert.strictEqual(res.statusCode, 405);
});

test('requires a paired session cookie', function () {
  var res = helpers.fakeRes();
  searchArtist(helpers.fakeReq('GET', '/api/spotify/search-artist?q=Beatles'), res);
  assert.strictEqual(res.statusCode, 401);
});

test('rejects an empty search query', function () {
  var res = helpers.fakeRes();
  searchArtist(helpers.fakeReq('GET', '/api/spotify/search-artist?q=', 'spotify_session=sid'), res);
  assert.strictEqual(res.statusCode, 400);
});

test('returns mapped artist results for a valid query', function () {
  var calledUrl = null;
  var restore = stubLib({
    kvGet: validSession, spotifyToken: validToken,
    request: function (url, options, cb) {
      calledUrl = url;
      cb(null, 200, { artists: { items: [{ id: 'abc123', name: 'Billie Holiday', images: [{ url: 'big.jpg' }, { url: 'small.jpg' }] }] } });
    }
  });
  var res = helpers.fakeRes();
  searchArtist(helpers.fakeReq('GET', '/api/spotify/search-artist?q=Billie%20Holiday', 'spotify_session=sid'), res);
  restore();
  assert.match(calledUrl, /type=artist/);
  assert.match(calledUrl, /q=Billie%20Holiday/);
  assert.strictEqual(res.statusCode, 200);
  var body = helpers.resBody(res);
  assert.strictEqual(body.artists.length, 1);
  assert.strictEqual(body.artists[0].id, 'abc123');
  assert.strictEqual(body.artists[0].name, 'Billie Holiday');
  assert.strictEqual(body.artists[0].image, 'small.jpg');
});
