/* Winamp Audio Analysis Engine - ES5 compatible with Safari iOS 9 */
(function() {
  'use strict';
  var audioAnalysis = {
    segments: [],
    segmentsMap: {},
    currentSegment: null,
    timestampOffset: 0,
    init: function() {
      var self = this;
      self.bindEvents();
    },
    loadAnalysis: function(payload) {
      var self = this;
      self.segments = payload.segments || [];
      self.segments.sort(function(a, b) { return a.start - b.start; });
      self.segmentsMap = {};
      self.currentSegment = null;
      var i;
      for (i = 0; i < self.segments.length; i++) {
        self.segmentsMap[self.segments[i].start] = self.segments[i];
      }
    },
    bindEvents: function() {
      var self = this;
      var message = function(text) {
        if (document.getElementById) {
          var el = document.getElementById('audio-analysis-status');
          if (el) el.innerHTML = text;
        }
      };
      var onAnalysisReceived = function(status, data) {
        if (status === 200 && data && data.segments) {
          self.loadAnalysis(data);
          message('Analysis loaded: ' + data.segments.length + ' segments');
          if (self.onAnalysisLoaded) self.onAnalysisLoaded();
        } else {
          message('Failed to load analysis: (HTTP ' + status + ')');
          if (self.onAnalysisError) self.onAnalysisError();
        }
      };
      var sendRequest = function() {
        var trackId = window.currentTrackId;
        if (!trackId) {
          message('No track loaded');
          return;
        }
        var url = '/api/spotify/audio-analysis?trackId=' + encodeURIComponent(trackId);
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = 30000;
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            var data = {};
            try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) {}
            onAnalysisReceived(xhr.status, data);
          }
        };
        xhr.ontimeout = function() { onAnalysisReceived(408, { error: 'Timeout' }); };
        xhr.onerror = function() { onAnalysisReceived(0, { error: 'Network error' }); };
        xhr.send();
      };
      
      window.requestAudioAnalysis = sendRequest;
      window.audioAnalysis = self;
    }
  };
  
  window.audioClock = {
    startTime: 0,
    pausedAt: 0,
    isPlaying: false,
    delta: 0,
    setProgress: function(progressMs) {
      this.startTime = performance.now() - progressMs + this.delta;
    },
    getCurrentTime: function() {
      if (!this.isPlaying) return this.pausedAt;
      this.delta = this.startTime - performance.now();
      return this.pausedAt + this.delta;
    },
    pause: function() {
      this.isPlaying = false;
    },
    resume: function() {
      this.isPlaying = true;
    },
    setPausedAt: function(time) {
      this.pausedAt = time;
    }
  };
  
  window.audioClock = audioClock;
  
  var eqBands = [
    60, 170, 310, 600, 1000,
    3000, 6000, 12000, 14000, 16000, 0
  ];
  
  window.eqBands = eqBands;
  
  // EQ gain storage: indexed by band number, value is gain multiplier (0.25 to 4.0)
  var eqGains = new Array(11).fill(1.0);
  
  // Apply EQ gain to a frequency value
  var applyEQGain = function(freqValue, bandIndex) {
    // Find which EQ band this frequency falls into
    var bandIdx = -1;
    var i;
    for (i = 0; i < eqBands.length - 1; i++) {
      if (freqValue >= eqBands[i] && freqValue < eqBands[i + 1]) {
        bandIdx = i;
        break;
      }
    }
    // If above highest band
    if (bandIdx === -1 && freqValue >= eqBands[eqBands.length - 2]) {
      bandIdx = eqBands.length - 2;
    }
    
    // Apply gain if band found
    if (bandIdx >= 0 && bandIdx < eqGains.length) {
      return freqValue * eqGains[bandIdx];
    }
    return freqValue;
  };
  
  var analyzeNow = function() {
    var self = window.audioAnalysis;
    var clock = window.audioClock;
    if (!self.segments || self.segments.length === 0) return {
      loudness: 0,
      frequencies: new Array(19).fill(0),
      eqApplied: false
    };
    var now = clock.getCurrentTime() / 1000;
    var seg = null;
    var nextSeg = null;
    var i;
    for (i = 0; i < self.segments.length; i++) {
      if (self.segments[i].start < now) {
        seg = self.segments[i];
      }
      if (self.segments[i].start <= now && (nextSeg === null || self.segments[i].start > nextSeg.start)) {
        nextSeg = self.segments[i];
      }
    }
    if (seg) {
      self.currentSegment = seg;
    }
    var loudness = (seg && typeof seg.loudness_max === 'number') ? seg.loudness_max : -60;
    var targetFreq = now - (seg ? seg.start : 0);
    var freqBins = [
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ];
    var i2;
    for (i2 = 0; i2 < 19 && (seg && i2 < (seg.pitches && seg.pitches.length || 0)); i2++) {
      // Calculate center frequency for this bin
      var centerFreq = (i2 + 1) * (16000 / 19);
      freqBins[i2] = (seg.pitches && seg.pitches[i2]) ? Math.max(0, (seg.pitches[i2] + 100) * 0.5) : 0;
      // Apply EQ gain to this frequency bin
      freqBins[i2] = applyEQGain(freqBins[i2], i2);
    }
    return {
      loudness: loudness,
      frequencies: freqBins,
      currentSegmentId: seg && seg.start ? Math.round(seg.start * 1000) : 0,
      eqGains: eqGains.slice()
    };
  };
  
  window.analyzeNow = analyzeNow;
  
  // Export EQ control functions
  window.setEQGain = function(bandIndex, gain) {
    if (bandIndex >= 0 && bandIndex < eqGains.length) {
      // Map dB (-12 to +12) to linear gain (0.25 to 4.0)
      eqGains[bandIndex] = Math.max(0.25, Math.min(4.0, Math.pow(10, gain / 20)));
    }
  };
  
  window.getEQGain = function(bandIndex) {
    if (bandIndex >= 0 && bandIndex < eqGains.length) {
      return eqGains[bandIndex];
    }
    return 1.0;
  };
  
  // Auto-init: bind the analysis request path and expose the engine
  audioAnalysis.init();
})();