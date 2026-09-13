var test = require('node:test');
var assert = require('node:assert');
var path = require('node:path');
var helpers = require('./helpers');

var lib = require(path.join('..', 'api', '_lib.js'));
var searchPlaylist = require(path.join('..', 'api', 'spotify', 'search-playlist.js'));

function stubLib(overrides) {
  var originals = {};
  Object.keys(overrides).forEach(function (key) { originals[key] = lib[key]; lib[key] = overrides[key]; });
  return function restore() { Object.keys(originals).forEach(function (key) { lib[key] = originals[key]; }); };
}

function validSession(key, cb) { cb(null, { refresh_token: 'refresh-token' }); }
function validToken(cfg, body, cb) { cb(null, 200, { access_token: 'access-token' }); }

test('rejects non-GET requests with 405', function () {
  var res = helpers.fakeRes();
  searchPlaylist(helpers.fakeReq('POST', '/api/spotify/search-playlist'), res);
  assert.strictEqual(res.statusCode, 405);
});

test('requires a paired session cookie', function () {
  var res = helpers.fakeRes();
  searchPlaylist(helpers.fakeReq('GET', '/api/spotify/search-playlist?q=Lofoten'), res);
  assert.strictEqual(res.statusCode, 401);
});

test('rejects an empty search query', function () {
  var res = helpers.fakeRes();
  searchPlaylist(helpers.fakeReq('GET', '/api/spotify/search-playlist?q=', 'spotify_session=sid'), res);
  assert.strictEqual(res.statusCode, 400);
});

test('returns mapped playlist results using the same request path as artist search', function () {
  var calledUrl = null;
  var restore = stubLib({
    kvGet: validSession, spotifyToken: validToken,
    request: function (url, options, cb) {
      calledUrl = url;
      cb(null, 200, { playlists: { items: [{ id: 'pl-123', name: 'Nordic Hits', images: [{ url: 'big.jpg' }, { url: 'small.jpg' }] }] } });
    }
  });
  var res = helpers.fakeRes();
  searchPlaylist(helpers.fakeReq('GET', '/api/spotify/search-playlist?q=Nordic%20Hits', 'spotify_session=sid'), res);
  restore();
  assert.match(calledUrl, /type=playlist/);
  assert.match(calledUrl, /market=NO/);
  assert.match(calledUrl, /limit=10/);
  assert.match(calledUrl, /q=Nordic%20Hits/);
  assert.strictEqual(res.statusCode, 200);
  var body = helpers.resBody(res);
  assert.strictEqual(body.playlists.length, 1);
  assert.strictEqual(body.playlists[0].id, 'pl-123');
  assert.strictEqual(body.playlists[0].name, 'Nordic Hits');
  assert.strictEqual(body.playlists[0].image, 'small.jpg');
});

test('retries with a smaller limit when the first Spotify request fails', function () {
  var urls = [];
  var restore = stubLib({
    kvGet: validSession, spotifyToken: validToken,
    request: function (url, options, cb) {
      urls.push(url);
      if (urls.length === 1) return cb(new Error('upstream timeout'));
      cb(null, 200, { playlists: { items: [{ id: 'pl-456', name: 'Autumn Affection', images: [] }] } });
    }
  });
  var res = helpers.fakeRes();
  searchPlaylist(helpers.fakeReq('GET', '/api/spotify/search-playlist?q=autumn%20affection', 'spotify_session=sid'), res);
  restore();
  assert.strictEqual(urls.length, 2);
  assert.match(urls[0], /limit=10/);
  assert.match(urls[1], /limit=3/);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(helpers.resBody(res).playlists[0].id, 'pl-456');
});
