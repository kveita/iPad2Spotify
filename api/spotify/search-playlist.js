var lib = require('../_lib');

function fetchWithTimeout(url, options, timeout, callback) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, timeout);
  var requestOptions = options || {};
  requestOptions.signal = controller.signal;
  fetch(url, requestOptions).then(function (response) {
    return response.text().then(function (text) {
      var data = null;
      try { data = JSON.parse(text); } catch (e) {}
      callback(null, response.status, data);
    });
  }).catch(function (err) {
    callback(err);
  }).then(function () {
    clearTimeout(timer);
  });
}

module.exports = function (req, res) {
  if ((req.method || '').toUpperCase() !== 'GET') return lib.json(res, 405, { error: 'Expected GET but received ' + req.method + '.' });
  var query = require('url').parse(req.url, true).query, q = (query.q || '').trim().slice(0, 100);
  if (!q) return lib.json(res, 400, { error: 'Enter a playlist to search.' });
  var clientId = process.env.SPOTIFY_CLIENT_ID, clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return lib.json(res, 503, { error: 'Spotify search is not configured.' });
  var auth = Buffer.from(clientId + ':' + clientSecret).toString('base64');
  fetchWithTimeout('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  }, 8000, function (tokenErr, tokenStatus, token) {
    if (tokenErr || tokenStatus !== 200 || !token || !token.access_token) return lib.json(res, 502, { error: 'Spotify search unavailable.' });
    var url = 'https://api.spotify.com/v1/search?q=' + encodeURIComponent(q) + '&type=playlist&market=NO&limit=5&offset=0';
    console.log('Starting playlist search request: ' + url);
    fetchWithTimeout(url, { headers: { Authorization: 'Bearer ' + token.access_token } }, 8000, function (apiErr, status, data) {
      if (apiErr) return lib.json(res, 502, { error: 'Spotify playlist search timed out or failed.' });
      console.log('Playlist search request completed with status: ' + status);
      if (status !== 200) return lib.json(res, status, data || { error: 'Spotify request failed.' });
      var items = (data.playlists && data.playlists.items) || [];
      var playlists = items.map(function (playlist) {
        return { id: playlist.id, name: playlist.name, image: playlist.images && playlist.images.length ? playlist.images[playlist.images.length - 1].url : '' };
      });
      lib.json(res, 200, { playlists: playlists });
    });
  });
};
