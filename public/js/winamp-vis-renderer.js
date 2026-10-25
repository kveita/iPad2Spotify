/* Winamp Spectrum Visualizer - ES5 + 30 FPS throttling + iOS 9 compatible */

(function() {
  'use strict';
  var canvas = document.getElementById('winamp-visualizer');
  if (!canvas) return;
  
  var ctx = canvas.getContext('2d');
  var width = canvas.width || 592;
  var height = canvas.height || 127;
  var barCount = 19;
  var barWidth = Math.floor(width / barCount);
  var bars = new Array(barCount).fill(0);
  var peaks = new Array(barCount).fill(0);
  
  var lastFrameTime = 0;
  var targetFPS = 30;
  var frameInterval = 1000 / targetFPS;
  
  var colors = [
    '#ff0000', '#ff2222', '#ff4444', '#ff6666', '#ff8888',
    '#ffaaaa', '#ffcccc', '#eeddee', '#ddccff', '#ccbbee',
    '#bbccff', '#99aaff', '#7799ff', '#5588ff', '#4477ff',
    '#3366ff', '#2266ff', '#1155ff', '#0044ff'
  ];
  
  var renderLoop = function(timestamp) {
    requestAnimationFrame(renderLoop);
    var elapsed = timestamp - lastFrameTime;
    if (elapsed > frameInterval) {
      lastFrameTime = timestamp - (elapsed % frameInterval);
      draw();
    }
  };
  
  var freqToBar = function(freqIndex) {
    var i;
    if (freqIndex >= barCount) freqIndex = barCount - 1;
    if (freqIndex < 0) freqIndex = 0;
    return freqIndex;
  };
  
  var updateBars = function(frequencyData) {
    var i;
    for (i = 0; i < barCount; i++) {
      var raw = (frequencyData[i] || 0) * 0.4;
      peaks[i] = peaks[i] * 0.8 + raw * 0.2;
      bars[i] = Math.max(2, peaks[i]);
      if (bars[i] > height - 10) bars[i] = height - 10;
    }
  };
  
  var applyEQ = function(bandIndex, strength) {
    // Use the real EQ gain from the analysis engine (0.25..4.0), fall back to flat
    if (window.getEQGain) {
      return window.getEQGain(bandIndex);
    }
    return Math.max(0.1, Math.min(4, Math.max(0.25, 1 + (strength * 0.4))));
  };
  
  // Bind Winamp EQ sliders to the analysis engine gain table (ES5)
  var bindEQSliders = function() {
    var sliders = document.querySelectorAll('.eq-slider');
    var i;
    for (i = 0; i < sliders.length; i++) {
      if (sliders[i]._eqBound) continue;
      sliders[i]._eqBound = true;
      (function(slider) {
        var applySlider = function() {
          var band = parseInt(slider.getAttribute('data-band'), 10);
          var idx = window.eqBands ? window.eqBands.indexOf(band) : -1;
          if (idx >= 0 && window.setEQGain) {
            // Map slider 0..100 to -12..+12 dB, engine converts to linear 0.25..4.0
            var dB = ((parseInt(slider.value, 10) || 50) / 100) * 24 - 12;
            window.setEQGain(idx, dB);
          }
        };
        if (slider.addEventListener) {
          slider.addEventListener('input', applySlider, false);
          slider.addEventListener('change', applySlider, false);
        }
        applySlider();
      })(sliders[i]);
    }
  };
  
  var draw = function() {
    var i;
    bindEQSliders();
    var eqSliders = document.querySelectorAll('.eq-slider');
    var eqValues = new Array(11).fill(0.5);
    for (i = 0; i < Math.min(eqSliders.length, 11); i++) {
      eqValues[i] = parseInt(eqSliders[i].value || 50, 10) / 100;
    }
    
    ctx.clearRect(0, 0, width, height);
    
    var gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(1, '#2288ff');
    
    for (i = 0; i < barCount; i++) {
      var barHeight = bars[i] * applyEQ(i, 0.5);
      var yPos = height - barHeight;
      
      ctx.fillStyle = gradient;
      ctx.fillRect(i * barWidth, yPos, barWidth - 1, barHeight);
      
      var peakX = i * barWidth + (barWidth - 1) / 2;
      var peakY = yPos - 3;
      if (peakY > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(peakX, peakY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    var frameDraws = document.getElementById('frame-draws');
    if (frameDraws) frameDraws.innerHTML = width + 'x' + height;
  };
  
  var updateFromAudioAnalysis = function(data) {
    updateBars(data.frequencies || new Array(barCount).fill(0));
  };
  
  window.updateVisualizer = updateFromAudioAnalysis;
  
  requestAnimationFrame(renderLoop);
  
  var tryResize = function() {
    var parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      width = canvas.width;
      height = canvas.height;
      barWidth = Math.floor(width / barCount);
    }
  };
  
  if (window.addEventListener) {
    window.addEventListener('resize', tryResize);
    tryResize();
  }
  
  var range = document.createRange ? document.createRange() : { createContextualFragment: function(html) { var d = document.createElement('div'); d.innerHTML = html; return d; } };
  var fragment = range.createDocumentFragment();

})();