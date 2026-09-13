var test = require('node:test');
var assert = require('node:assert');
var path = require('node:path');
var helpers = require('./helpers');

var searchPlaylist = require(path.join('..', 'api', 'spotify', 'search-playlist.js'));

function fakeFetchSequence(responses, calls) {
  return function (url, options) {
    calls.push({ url: url, options: options });
    var response = responses.shift();
    return Promise.resolve({
      status: response.status,
      text: function () { return Promise.resolve(JSON.stringify(response.body)); }
    });
  };
}

async function withConfigAndFetch(fetch, callback) {
  var originalFetch = global.fetch;
  var originalId = process.env.SPOTIFY_CLIENT_ID;
  var originalSecret = process.env.SPOTIFY_CLIENT_SECRET;
  global.fetch = fetch;
  process.env.SPOTIFY_CLIENT_ID = 'client-id';
  process.env.SPOTIFY_CLIENT_SECRET = 'client-secret';
  try { await callback(); } finally {
    global.fetch = originalFetch;
    if (originalId === undefined) delete process.env.SPOTIFY_CLIENT_ID; else process.env.SPOTIFY_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.SPOTIFY_CLIENT_SECRET; else process.env.SPOTIFY_CLIENT_SECRET = originalSecret;
  }
}

function settled() { return new Promise(function (resolve) { setImmediate(resolve); }); }

test('rejects non-GET requests with 405', function () {
  var res = helpers.fakeRes();
  searchPlaylist(helpers.fakeReq('POST', '/api/spotify/search-playlist'), res);
  assert.strictEqual(res.statusCode, 405);
});

test('rejects an empty search query', function () {
  var res = helpers.fakeRes();
  searchPlaylist(helpers.fakeReq('GET', '/api/spotify/search-playlist?q='), res);
  assert.strictEqual(res.statusCode, 400);
});

test('returns mapped playlist results without KV or Redis', async function () {
  var calls = [];
  await withConfigAndFetch(fakeFetchSequence([
    { status: 200, body: { access_token: 'access-token' } },
    { status: 200, body: { playlists: { items: [{ id: 'pl-123', name: 'Nordic Hits', images: [{ url: 'big.jpg' }, { url: 'small.jpg' }] }] } } }
  ], calls), async function () {
    var res = helpers.fakeRes();
    searchPlaylist(helpers.fakeReq('GET', '/api/spotify/search-playlist?q=Nordic%20Hits'), res);
    await settled();
    assert.strictEqual(res.statusCode, 200);
    var body = helpers.resBody(res);
    assert.strictEqual(body.playlists.length, 1);
    assert.strictEqual(body.playlists[0].id, 'pl-123');
    assert.strictEqual(body.playlists[0].image, 'small.jpg');
    assert.match(calls[1].url, /type=playlist/);
    assert.match(calls[1].url, /market=NO/);
    assert.match(calls[1].url, /limit=5/);
  });
});

test('returns a controlled error when Spotify search fails', async function () {
  var calls = [];
  await withConfigAndFetch(fakeFetchSequence([
    { status: 200, body: { access_token: 'access-token' } },
    { status: 503, body: { error: { status: 503, message: 'upstream unavailable' } } }
  ], calls), async function () {
    var res = helpers.fakeRes();
    searchPlaylist(helpers.fakeReq('GET', '/api/spotify/search-playlist?q=autumn%20affection'), res);
    await settled();
    assert.strictEqual(res.statusCode, 503);
  });
});
