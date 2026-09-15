// Minimal DOM smoke test for the Winamp frontend wiring.
// Runs under `node --test` with NO external dependencies (no jsdom/vitest).
// It shims just enough of the DOM for app.js to load (all elements exist) and
// verifies the Winamp toggle, controls, and render-population wire correctly.
// NOTE: app.js is IIFE-wrapped ES5, so we drive it via the DOM handlers it
// attaches at load, not by calling functions directly.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

class El {
  constructor(id) { this._id = id; this.innerHTML = ''; this.className = ''; this.style = {}; this.handlers = {}; }
  addEventListener(ev, fn) { this.handlers[ev] = fn; }
  set className(v) { this._className = v; } get className() { return this._className || ''; }
  set src(v) { this._src = v; } get src() { return this._src; }
  get value() { return this._value || ''; } set value(v) { this._value = v; }
  set onclick(fn) { this.handlers['click'] = fn; }
  focus() {}
}

function buildDom() {
  const els = {};
  const idTags = [...html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)];
  for (const m of idTags) {
    const el = new El(m[1]);
    const clsMatch = m[0].match(/class="([^"]*)"/);
    if (clsMatch) el._className = clsMatch[1];
    els[m[1]] = el;
  }
  // Seed initial innerHTML for elements whose plain text ends up asserted.
  const seed = {
    'winamp-toggle': 'Winamp Mode',
    'winamp-track': 'Nothing playing',
    'winamp-elapsed': '0:00',
    'winamp-duration': '0:00',
    'winamp-message': 'Updates every 5 seconds'
  };
  for (const k in seed) if (els[k]) els[k].innerHTML = seed[k];
  const document = {
    getElementById: (id) => {
      if (!els[id]) throw new Error('Missing element: ' + id);
      return els[id];
    },
    body: new El('body'),
    getElementsByTagName: () => [],
  };
  return { document, els };
}

function loadApp() {
  const { document, els } = buildDom();
  const script = js.replace(
    /request\('GET','\/api\/spotify\/currently-playing',null,function\(status\)\{if\(status===200\)showPlayer\(\)\}\);/,
    '' // strip the startup poll
  );
  // Provide the request function used at startup poll — we stripped it, fine.
  const fn = new Function('document', 'window', 'location', 'XMLHttpRequest', 'setInterval', 'clearTimeout', 'setTimeout', script + '\n;window.__winampOn=function(){return typeof winampOn!=="undefined"?winampOn:null};\nwindow.__getWinampEls=function(){return "<<<WINAMP_ELS>>>"};');
  // We can't reach closure vars directly; instead drive via DOM clicks.
  // Call the IIFE. Provide stubs.
  fn(document, {location: {host:'x',href:''}}, {host:'x', href:''}, class {
    open(){} setRequestHeader(){} send(){} set timeout(v){} get timeout(){return 120000}
  }, function(){}, function(){}, function(){});
  return { document, els };
}

test('app.js loads without throwing (all referenced ids exist)', () => {
  assert.doesNotThrow(() => loadApp());
});

test('Winamp toggle shows/hides the winamp player and swaps label', () => {
  const { els } = loadApp();
  const toggle = els['winamp-toggle'];
  const wp = els['winamp-player'];
  assert.ok(toggle.handlers['click'], 'winamp-toggle has a click handler');
  // Initially hidden + label "Winamp Mode"
  assert.ok(wp.className.includes('hidden'));
  assert.strictEqual(toggle.innerHTML, 'Winamp Mode');
  // Click on
  toggle.handlers['click']();
  assert.ok(!wp.className.includes('hidden'), 'winamp player shown after toggle on');
  assert.strictEqual(toggle.innerHTML, 'Exit Winamp');
  assert.ok(els['player'].className.includes('hidden'), 'regular player hidden');
  // Click off
  toggle.handlers['click']();
  assert.ok(wp.className.includes('hidden'), 'winamp player hidden after toggle off');
  assert.strictEqual(toggle.innerHTML, 'Winamp Mode');
});

test('Winamp controls fire playback commands', () => {
  const { document, els } = loadApp();
  // Expose the closure-scoped command(), and make the XHR stub capture URL+body.
  const jsProbe = js.replace(
    'request(\'GET\',\'/api/spotify/currently-playing\',null,function(status){if(status===200)showPlayer()});',
    'window.__expose={};window.__expose.command=command;'
  );
  const w = { location: { host: 'x', href: '' }, __captured: [] };
  class CapturingXHR {
    open(m, u, a) { this._method = m; this.url = u; }
    setRequestHeader() {}
    set timeout(v) {}
    send(body) {
      w.__captured.push({ method: this._method, body: body });
      if (this.onreadystatechange) { this.readyState = 4; this.status = 200; this.onreadystatechange(); }
    }
  }
  const probeFn = new Function('document', 'window', 'location', 'XMLHttpRequest', 'setInterval', 'clearTimeout', 'setTimeout', jsProbe);
  probeFn(document, w, { host: 'x', href: '' }, CapturingXHR, function(){}, function(){}, function(){});
  els['winamp-play'].handlers['click']();
  els['winamp-prev'].handlers['click']();
  els['winamp-next'].handlers['click']();
  const actions = w.__captured.map((c) => JSON.parse(c.body).action);
  assert.ok(actions.includes('play'), 'play command sent, got: ' + actions);
  assert.ok(actions.includes('previous'), 'previous command sent');
  assert.ok(actions.includes('next'), 'next command sent');
});

test('render() populates winamp track, time and progress', () => {
  const { document, els } = loadApp();
  // Expose the closure-scoped render/updateTimeline by appending an export line.
  const jsProbe = js.replace(
    'request(\'GET\',\'/api/spotify/currently-playing\',null,function(status){if(status===200)showPlayer()});',
    'window.__expose={};window.__expose.render=render;window.__expose.updateTimeline=updateTimeline;window.__expose.setWinamp=setWinamp;'
  );
  const w = { location: { host: 'x', href: '' } };
  const probeFn = new Function('document', 'window', 'location', 'XMLHttpRequest', 'setInterval', 'clearTimeout', 'setTimeout',
    jsProbe);
  probeFn(document, w, { host: 'x', href: '' }, class { open(){} setRequestHeader(){} send(){} set timeout(v){} },
    function(){}, function(){}, function(){});
  const track = {
    name: 'Test Song',
    artists: [{ name: 'Artist One' }],
    album: { name: 'Album X', images: [{ url: 'http://img/x.jpg' }] },
    duration_ms: 200000
  };
  const data = { is_playing: true, progress_ms: 50000, item: track };
  w.__expose.setWinamp(true);
  w.__expose.render(data);
  assert.ok(!els['winamp-player'].className.includes('hidden'), 'winamp visible after toggle+render');
  assert.ok(els['winamp-track'].innerHTML.includes('Test Song'), 'track name in marquee');
  assert.ok(els['winamp-track'].innerHTML.includes('Artist One'), 'artist in marquee');
  assert.match(els['winamp-elapsed'].innerHTML, /^0:50$/, 'elapsed shows 0:50');
  assert.match(els['winamp-duration'].innerHTML, /^3:20$/, 'duration shows 3:20');
  assert.strictEqual(els['winamp-fill'].style.width, '25%', 'progress bar at 25%');
});

test('Winamp exit restores the regular player', () => {
  const { document, els } = loadApp();
  const jsProbe = js.replace(
    'request(\'GET\',\'/api/spotify/currently-playing\',null,function(status){if(status===200)showPlayer()});',
    'window.__expose={};window.__expose.render=render;window.__expose.setWinamp=setWinamp;'
  );
  const w = { location: { host: 'x', href: '' } };
  const probeFn = new Function('document', 'window', 'location', 'XMLHttpRequest', 'setInterval', 'clearTimeout', 'setTimeout', jsProbe);
  probeFn(document, w, { host: 'x', href: '' }, class { open(){} setRequestHeader(){} send(){} set timeout(v){} },
    function(){}, function(){}, function(){});
  w.__expose.setWinamp(true);
  assert.ok(els['player'].className.includes('hidden'));
  // exit via the close button
  els['winamp-exit'].handlers['click']();
  assert.ok(!els['player'].className.includes('hidden'), 'regular player restored on exit');
  assert.ok(els['winamp-player'].className.includes('hidden'), 'winamp hidden after exit');
});