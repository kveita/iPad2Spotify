var lib = require('../_lib');
module.exports = function (req, res) {
  if ((req.method || '').toUpperCase() !== 'GET') return lib.json(res, 405, { error: 'Expected GET but received ' + req.method + '.' });
  var query = require('url').parse(req.url, true).query, q = (query.q || '').trim().slice(0, 100);
  if (!q) return lib.json(res, 400, { error: 'Enter an artist name to search.' });
  // Check cache first (before session validation to save time)
  var cacheKey = 'search:artist:' + encodeURIComponent(q);
  lib.kvGet(cacheKey, function (cacheErr, cached) {
    if (!cacheErr && cached && Array.isArray(cached.artists)) return lib.json(res, 200, cached);
    // Only validate session if cache miss
    lib.rateLimit(req, 'search-artist', 30, 60, function (limitErr, limited) {
      if (limitErr) return lib.json(res, 503, { error: 'Rate-limit storage is unavailable.' });
      if (limited) return lib.json(res, 429, { error: 'Too many searches. Try again shortly.' });
      var sid = lib.cookie(req, 'spotify_session');
      if (!sid) return lib.json(res, 401, { error: 'Pair this fullscreen app first.' });
      lib.kvGet('session:' + sid, function (err, session) {
        if (err || !session) return lib.json(res, 401, { error: 'Session expired. Pair again.' });
        var cfg = lib.config(req);
        lib.spotifyToken(cfg, 'grant_type=client_credentials', function (tokenErr, tokenStatus, token) {
          if (tokenErr || tokenStatus !== 200 || !token.access_token) return lib.json(res, 502, { error: 'Spotify search unavailable.' });
          var url = 'https://api.spotify.com/v1/search?q=' + encodeURIComponent(q) + '&type=artist&market=NO&limit=10&offset=0';
          console.log('Starting artist search request: ' + url);
          lib.request(url, { headers: { Authorization: 'Bearer ' + token.access_token } }, function (apiErr, status, data) {
            console.log('Artist search request completed with status: ' + status);
            if (apiErr) return lib.json(res, 502, { error: 'Spotify request failed.' });
            if (status !== 200) return lib.json(res, status, data || { error: 'Spotify request failed.' });
            var items = (data.artists && data.artists.items) || [];
            var artists = items.map(function (artist) {
              return { id: artist.id, name: artist.name, image: artist.images && artist.images.length ? artist.images[artist.images.length - 1].url : '' };
            });
            var result = { artists: artists };
            // Cache result for 5 minutes
            lib.kvSet(cacheKey, result, 300, function () {});
            lib.json(res, 200, result);
          });
        });
      });
    });
  });
};
