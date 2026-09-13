var lib = require('../_lib');
module.exports = function (req, res) {
  if ((req.method || '').toUpperCase() !== 'GET') return lib.json(res, 405, { error: 'Expected GET but received ' + req.method + '.' });
  var query = require('url').parse(req.url, true).query, q = (query.q || '').trim().slice(0, 100);
  if (!q) return lib.json(res, 400, { error: 'Enter a playlist to search.' });
  var sid = lib.cookie(req, 'spotify_session');
  if (!sid) return lib.json(res, 401, { error: 'Pair this fullscreen app first.' });
  lib.kvGet('session:' + sid, function (err, session) {
    if (err || !session) return lib.json(res, 401, { error: 'Session expired. Pair again.' });
    var cfg = lib.config(req);
    lib.spotifyToken(cfg, 'grant_type=client_credentials', function (tokenErr, tokenStatus, token) {
      if (tokenErr || tokenStatus !== 200 || !token.access_token) return lib.json(res, 502, { error: 'Spotify search unavailable.' });
      function search(limit, done) {
        var url = 'https://api.spotify.com/v1/search?q=' + encodeURIComponent(q) + '&type=playlist&market=NO&limit=' + limit + '&offset=0';
        console.log('Starting playlist search request: ' + url);
        lib.request(url, { headers: { Authorization: 'Bearer ' + token.access_token }, timeout: 10000 }, function (apiErr, status, data) {
          console.log('Playlist search request completed with status: ' + status);
          done(apiErr, status, data);
        });
      }
      function respond(apiErr, status, data) {
        if (apiErr) return lib.json(res, 502, { error: 'Spotify request failed.' });
        if (status !== 200) return lib.json(res, status, data || { error: 'Spotify request failed.' });
        var items = (data.playlists && data.playlists.items) || [];
        var playlists = items.map(function (playlist) {
          return { id: playlist.id, name: playlist.name, image: playlist.images && playlist.images.length ? playlist.images[playlist.images.length - 1].url : '' };
        });
        lib.json(res, 200, { playlists: playlists });
      }
      search(10, function (apiErr, status, data) {
        if (!apiErr && status === 200) return respond(null, status, data);
        // Spotify can intermittently stall on a larger playlist result set for some queries.
        // Retry once with the smaller result set before returning a controlled error.
        search(3, respond);
      });
    });
  });
};
