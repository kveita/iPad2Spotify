var lib = require('../_lib');
var crypto = require('crypto');

// Strip and compress Spotify audio analysis payload
function sanitizeAnalysis(data) {
  var safe = {
    tatums: [],
    beats: [],
    bars: [],
    sections: [],
    segments: []
  };
  var normalizeObj = function(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    var result = {};
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = normalizeObj(obj[key]);
      }
    }
    return result;
  };
  var sanitizeArr = function(arr) {
    if (!Array.isArray(arr)) return arr;
    var result = [];
    for (var i = 0; i < arr.length; i++) {
      if (typeof arr[i] === 'object' && arr[i] !== null) {
        result[i] = {};
        for (var j in arr[i]) {
          var val = arr[i][j];
          if (['start', 'duration', 'liveness', 'energy', 'mode', 'key'].indexOf(j) >= 0 || typeof val === 'number') {
            result[i][j] = val;
          }
        }
      } else {
        result[i] = arr[i];
      }
    }
    return result;
  };
  if (data && data.tatums) safe.tatums = sanitizeArr(data.tatums.map(function(t) { return { start: t.start, duration: t.duration }; }));
  if (data && data.beats) safe.beats = sanitizeArr(data.beats.map(function(b) { return { start: b.start, duration: b.duration }; }));
  if (data && data.bars) safe.bars = sanitizeArr(data.bars.map(function(b) { return { start: b.start, duration: b.duration }; }));
  if (data && data.sections) safe.sections = sanitizeArr(data.sections.map(function(s) { return { start: s.start, duration: s.duration }; }));
  if (data && data.segments) safe.segments = sanitizeArr(data.segments.map(function(s) {
    var seg = {};
    if (typeof s.start === 'number') seg.start = s.start;
    if (typeof s.duration === 'number') seg.duration = s.duration;
    if (typeof s.loudness_start === 'number') seg.loudness_start = s.loudness_start;
    if (typeof s.loudness_max === 'number') seg.loudness_max = s.loudness_max;
    if (typeof s.loudness_max_time === 'number') seg.loudness_max_time = s.loudness_max_time;
    if (s.pitches && Array.isArray(s.pitches)) {
      var p = [];
      for (var k = 0; k < 12 && k < s.pitches.length; k++) {
        if (typeof s.pitches[k] === 'number') p[k] = s.pitches[k];
      }
      seg.pitches = p;
    }
    if (s.timbre && Array.isArray(s.timbre)) {
      var t = [];
      for (var k = 0; k < 12 && k < s.timbre.length; k++) {
        if (typeof s.timbre[k] === 'number') t[k] = s.timbre[k];
      }
      seg.timbre = t;
    }
    return seg;
  }));
  return safe;
}

module.exports = function(req, res) {
  var trackId = req.query.trackId;
  if (!trackId) return lib.json(res, 400, { error: 'trackId required' });
  var sid = lib.cookie(req, 'spotify_session');
  if (!sid) return lib.json(res, 401, { error: 'Pair this fullscreen app first.' });
  lib.kvGet('session:' + sid, function(err, session) {
    if (err || !session) return lib.json(res, 401, { error: 'Session expired. Pair again.' });
    var cfg = lib.config(req);
    
    lib.spotifyToken(cfg, 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(session.refresh_token), function(tokenErr, tokenStatus, token) {
      if (tokenErr || tokenStatus !== 200 || !token.access_token) return lib.json(res, 401, { error: 'Spotify authorization expired. Pair again.' });
      var cacheKey = 'analyze:' + crypto.createHash('md5').update('spotify-analysis-' + trackId).digest('hex');
      lib.kvGet(cacheKey, function(cacheErr, cached) {
        if (!cacheErr && cached) return lib.json(res, 200, cached);
        lib.request('https://api.spotify.com/v1/audio-analysis/' + trackId, { headers: { Authorization: 'Bearer ' + token.access_token } }, function(apiErr, status, data) {
          if (apiErr) return lib.json(res, 502, { error: 'Spotify Audio Analysis fetch failed.' });
          if (status !== 200) return lib.json(res, status, data || { error: 'Spotify request failed.' });
          var payload = sanitizeAnalysis(data);
          var blob = JSON.stringify(payload);
          if (blob.length > 20000) {
            lib.kvSet(cacheKey, { warning: 'Payload truncated to fit LRU' }, 86400, function(saveErr) {});
          }
          lib.kvSet(cacheKey, payload, 86400, function(saveErr) {
            if (saveErr) console.log('Analysis cache save failed:', saveErr.message);
            res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
            lib.json(res, 200, payload);
          });
        });
      });
    });
  });
};