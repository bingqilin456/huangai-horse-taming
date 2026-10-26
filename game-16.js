(function (root) {
  'use strict';
  function createPlayer(runtime, clips = {}) {
    let audio = null, output = null, text = '', enabled = true, failed = false, playing = false, volume = 1;
    const byText = new Map(Object.values(clips).map(clip => [clip.text, clip]));
    const hidden = () => !!runtime.document?.hidden;
    function pause() { if (audio) audio.pause(); playing = false; }
    function stop() {
      pause();
      if (output) { try { output.disconnect(); } catch (_) { /* Output may already be closed. */ } }
      output = null; audio = null; text = ''; failed = false;
    }
    function resume() {
      if (!audio || !enabled || hidden()) return;
      const selected = audio; failed = false;
      try {
        if (!output && runtime.GameAudio?.connectVoice) output = runtime.GameAudio.connectVoice(audio);
        if (audio.ended) audio.currentTime = 0;
        playing = true;
        Promise.resolve(audio.play()).catch(() => { if (audio === selected) { playing = false; failed = true; } });
      } catch (_) { playing = false; failed = true; }
    }
    function select(message) {
      if (message === text) return;
      stop(); text = message;
      const clip = byText.get(message);
      if (!clip || !/^data:audio\//.test(clip.src) || !runtime.Audio) return;
      try {
        const selected = new runtime.Audio(clip.src); audio = selected; audio.preload = 'auto'; audio.volume = volume;
        for (const event of ['ended', 'pause', 'error']) audio.addEventListener(event, () => {
          if (audio !== selected) return;
          playing = false; if (event === 'error') failed = true;
        });
        resume();
      } catch (_) { audio = null; failed = true; }
    }
    function replay() { if (audio) { audio.currentTime = 0; resume(); } }
    function setEnabled(value) { enabled = !!value; if (!enabled) pause(); }
    function setVolume(value) { volume = Math.max(0, Math.min(1, Number(value) || 0)); if (audio) audio.volume = volume; }
    runtime.document?.addEventListener('visibilitychange', () => { if (hidden()) pause(); });
    return { select, pause, resume, replay, stop, setEnabled, setVolume,
      get available() { return !!audio; }, get playing() { return playing; }, get enabled() { return enabled; }, get error() { return failed; },
      get elapsed() { return audio?.currentTime || 0; }, get duration() { return Number.isFinite(audio?.duration) ? audio.duration : 0; }
    };
  }
  const api = { createPlayer };
  root.GameVoice = api;
  root.CuratorVoice = createPlayer(root, root.CuratorAudio || {});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
