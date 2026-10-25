(function () {
  'use strict';
  // Run in the head, before parsing the large embedded artwork and 3D model.
  function fit() {
    document.documentElement.style.setProperty('--stage-scale', Math.min(innerWidth / 1280, innerHeight / 720));
  }
  fit();
  window.addEventListener('resize', fit);
})();
