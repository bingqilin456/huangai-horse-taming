(function (root, factory) {
  'use strict';
  const api = factory(root);
  root.GameAudio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  let enabled = true, unlocked = false, context = null, master = null, output = null, loop = null;
  let noise = null, masterLevel = -1, paused = false, voiceCategory = 'gameplay';
  let musicEnabled = true, music = null, lastInfo = {};
  let musicVolume = 1, sfxVolume = 1;
  const players = new Map();
  const active = new Set(), lastPlay = Object.create(null);
  const hidden = () => !!(root.document && root.document.hidden);
  const audioReady = () => unlocked && context && context.state === 'running' && !hidden();
  const ready = () => enabled && audioReady();
  const time = () => context ? context.currentTime : 0;
  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
  function disconnect(node) { try { node.disconnect(); } catch (_) { /* Device already closed. */ } }
  function ramp(param, value, seconds) {
    const now = time();
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(Number.isFinite(param.value) ? param.value : 0, now);
      param.linearRampToValueAtTime(value, now + seconds);
    } catch (_) { /* Audio must never interrupt gameplay. */ }
  }
  function level(value) {
    if (!master || masterLevel === value) return;
    masterLevel = value; ramp(master.gain, value, 0.06);
  }
  // 音效与背景音乐独立调节，最终与配音一起进入放大和限幅输出。
  const sfxLevel = () => 0.72 * sfxVolume;
  function stop(source, delay) { try { source.stop(time() + delay); } catch (_) { /* Already stopped. */ } }
  function stopLoop() {
    if (!loop) return;
    const old = loop; loop = null;
    ramp(old.gain.gain, 0, 0.08);
    old.sources.forEach(source => stop(source, 0.1));
  }
  function stopVoices(includeUi = true) {
    for (const voice of active) {
      if (!includeUi && voice.category === 'ui') continue;
      ramp(voice.gain.gain, 0, 0.035); stop(voice.source, 0.05); active.delete(voice);
    }
  }
  function quiet() { level(0); stopLoop(); stopVoices(); }
  function stopMusic(immediate = false) {
    music = null;
    for (const player of players.values()) {
      player.attempt++; player.pending = false;
      if (player.timer) { root.clearTimeout(player.timer); player.timer = null; }
      if (player.media.paused) continue;
      ramp(player.gain.gain, 0, immediate ? 0 : 0.5); player.level = 0;
      if (immediate) player.media.pause();
      else player.timer = root.setTimeout(() => { player.media.pause(); player.timer = null; }, 550);
    }
  }
  function musicScene(info) {
    if (info.overlay === 'shop') return 'shop';
    if (['museum', 'official'].includes(info.overlay)) return 'museum';
    if (['difficulty', 'ready'].includes(info.overlay)) return 'title';
    if (info.paused) return '';
    if (['archive', 'victory'].includes(info.state)) return 'museum';
    if (['taming', 'tiger'].includes(info.state)) return info.state;
    return ['title', 'map'].includes(info.state) ? 'title' : '';
  }
  function updateMusic(info) {
    const kind = musicScene(info), track = root.GameMusic && root.GameMusic[kind];
    if (!musicEnabled || !audioReady() || !track || !/^data:audio\//.test(track.src) || !root.Audio) {
      if (music) stopMusic(!musicEnabled || hidden());
      return;
    }
    try {
      if (!music || music.kind !== kind) {
        // Only a scene change schedules fades; frame updates cannot postpone them.
        if (music) stopMusic();
        let player = players.get(kind);
        if (!player) {
          const media = new root.Audio(track.src), gain = context.createGain();
          media.loop = true; media.preload = 'none'; gain.gain.value = 0;
          const source = context.createMediaElementSource(media);
          source.connect(gain); gain.connect(output);
          player = { kind, media, source, gain, timer: null, failed: false, level: 0, pending: false, attempt: 0 };
          media.addEventListener('error', () => { player.failed = true; media.pause(); });
          players.set(kind, player);
        }
        music = player;
        if (player.timer) { root.clearTimeout(player.timer); player.timer = null; }
      }
      const player = music;
      if (player.failed) return;
      if (player.media.paused && !player.pending) {
        const attempt = ++player.attempt; player.pending = true;
        Promise.resolve(player.media.play()).then(() => {
          if (attempt !== player.attempt) return;
          player.pending = false;
          if (music !== player || !musicEnabled || !audioReady()) player.media.pause();
        }).catch(() => {
          if (attempt !== player.attempt) return;
          player.pending = false; player.failed = true; player.media.pause();
        });
      }
      const volume = clamp(track.gain === undefined ? 0.32 : track.gain) * musicVolume * (info.duck ? 0.22 : 1);
      if (player.level !== volume) { player.level = volume; ramp(player.gain.gain, volume, 0.5); }
    } catch (_) { if (music) { music.failed = true; music.pending = false; music.media.pause(); } }
  }
  function unlock() {
    if ((!enabled && !musicEnabled) || hidden()) return Promise.resolve(false);
    for (const player of players.values()) player.failed = false;
    try {
      if (!context) {
        const Audio = root.AudioContext || root.webkitAudioContext;
        if (!Audio) return Promise.resolve(false);
        context = new Audio();
        master = context.createGain(); master.gain.value = 0;
        // 全部声音统一提升约6dB；限幅作用于最终混音，包含音乐、音效和馆长配音。
        output = context.createGain(); output.gain.value = 2;
        master.connect(output);
        let destination = context.destination;
        // 压缩器有起音时间，配音瞬态仍可能越过满幅；最后一级平滑收拢峰值。
        if (typeof context.createWaveShaper === 'function') {
          const guard = context.createWaveShaper(), curve = new Float32Array(4097);
          for (let i = 0; i < curve.length; i++) {
            const x = i * 2 / (curve.length - 1) - 1, magnitude = Math.abs(x);
            curve[i] = magnitude <= 0.85 ? x : Math.sign(x) * (0.85 + 0.12 * Math.tanh((magnitude - 0.85) / 0.12));
          }
          guard.curve = curve; guard.oversample = '4x';
          guard.connect(destination); destination = guard;
        }
        if (typeof context.createDynamicsCompressor === 'function') {
          const limiter = context.createDynamicsCompressor();
          limiter.threshold.value = -3; limiter.knee.value = 3; limiter.ratio.value = 12;
          limiter.attack.value = 0.003; limiter.release.value = 0.2;
          output.connect(limiter); limiter.connect(destination);
        } else output.connect(destination);
      }
      unlocked = context.state === 'running';
      if (ready()) level(sfxLevel());
      const resumed = unlocked ? Promise.resolve() : context.resume();
      return Promise.resolve(resumed).then(() => {
        unlocked = context.state === 'running';
        if (ready()) level(sfxLevel());
        updateMusic(lastInfo);
        return !!unlocked;
      }).catch(() => false);
    } catch (_) { return Promise.resolve(false); }
  }
  function connectVoice(media) {
    if (!context || !output) return null;
    try {
      const source = context.createMediaElementSource(media);
      source.connect(output);
      return source;
    } catch (_) { return null; }
  }
  function tone(frequency, duration, volume, delay, endFrequency, type) {
    if (!ready() || active.size >= 24) return;
    try {
      const source = context.createOscillator(), gain = context.createGain();
      const start = time() + (delay || 0);
      source.type = type || 'sine';
      source.frequency.setValueAtTime(frequency, start);
      if (endFrequency) source.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(gain); gain.connect(master);
      const voice = { source, gain, category: voiceCategory }; active.add(voice);
      source.onended = () => { active.delete(voice); disconnect(source); disconnect(gain); };
      source.start(start); source.stop(start + duration + 0.025);
    } catch (_) { /* Unsupported or interrupted audio device. */ }
  }
  function rustle(frequency, duration, volume, filterType) {
    if (!ready() || active.size >= 24) return;
    try {
      if (!noise) {
        noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.25), context.sampleRate);
        const samples = noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
      source.buffer = noise; filter.type = filterType || 'lowpass'; filter.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, time());
      gain.gain.exponentialRampToValueAtTime(0.0001, time() + duration);
      source.connect(filter); filter.connect(gain); gain.connect(master);
      const voice = { source, gain, category: voiceCategory }; active.add(voice);
      source.onended = () => { active.delete(voice); [source, filter, gain].forEach(disconnect); };
      source.start(); source.stop(time() + duration + 0.01);
    } catch (_) { /* Noise is optional. */ }
  }
  function play(name) {
    if (!ready()) return;
    const group = name === 'select' ? 'ui' : name;
    const now = time(), interval = group === 'ui' ? 0.09 : group === 'victory' ? 1.5 : 0.07;
    if (lastPlay[group] !== undefined && now - lastPlay[group] < interval) return;
    lastPlay[group] = now;
    voiceCategory = ['ui', 'coin', 'start', 'success', 'reward', 'collect', 'victory', 'pause'].includes(group) ? 'ui' : 'gameplay';
    switch (group) {
      case 'ui': tone(440, 0.065, 0.055, 0, 330); break;
      case 'coin': tone(740, 0.18, 0.07); tone(1110, 0.12, 0.025, 0.035); break;
      case 'start': tone(196, 0.2, 0.065); tone(392, 0.28, 0.055, 0.1); break;
      case 'success': [392, 494, 587].forEach((f, i) => tone(f, 0.25, 0.055, i * 0.085)); break;
      case 'reward': [523, 659, 784, 1047].forEach((f, i) => { tone(f, 0.35, 0.065, i * 0.115); tone(f * 2, 0.18, 0.012, i * 0.115 + 0.02); }); break;
      case 'collect': tone(659, 0.22, 0.055); tone(988, 0.3, 0.045, 0.11); break;
      case 'progress': tone(587, 0.12, 0.045); tone(784, 0.18, 0.035, 0.09); break;
      // 驯马进度激励：GOOD → GREAT → PERFECT，逐级加亮、加长，模拟消除类游戏的即时正反馈。
      case 'good': [659, 880].forEach((f, i) => tone(f, 0.2, 0.16, i * 0.075)); break;
      case 'great': [784, 988, 1175].forEach((f, i) => tone(f, 0.3, 0.17, i * 0.075)); tone(1568, 0.24, 0.09, 0.16); break;
      case 'perfect': [1047, 1319, 1568, 2093].forEach((f, i) => { tone(f, 0.4, 0.18, i * 0.08); tone(f * 2, 0.16, 0.05, i * 0.08 + 0.01); }); break;
      // 双虎战完美弹反：金属撞击 + 低频冲击 + 高音钟磬琶音，明显区别于普通受击。
      case 'parry':
        rustle(5200, 0.09, 0.34, 'highpass');
        tone(150, 0.24, 0.26, 0, 46, 'triangle');
        tone(1180, 0.3, 0.22, 0, 700, 'triangle');
        tone(1760, 0.55, 0.16, 0.01);
        tone(2637, 0.4, 0.08, 0.015);
        [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.3, 0.12, 0.09 + i * 0.055));
        break;
      case 'dodge-ready': tone(880, 0.10, 0.1); tone(1175, 0.12, 0.07, 0.08); break;
      case 'fail': tone(220, 0.32, 0.075, 0, 82); break;
      case 'attack': rustle(1300, 0.07, 0.09); tone(170, 0.12, 0.09, 0, 60, 'triangle'); break;
      case 'dodge': rustle(1800, 0.15, 0.045); tone(320, 0.13, 0.035, 0, 640); break;
      case 'counter': tone(600, 0.19, 0.065, 0, 240); tone(900, 0.1, 0.025); break;
      case 'hit': rustle(550, 0.14, 0.1); tone(95, 0.22, 0.1, 0, 42); break;
      case 'victory': [262, 330, 392, 523].forEach((f, i) => tone(f, 0.6, 0.045, i * 0.17)); break;
      case 'pause': tone(294, 0.12, 0.04, 0, 220); break;
      default: break;
    }
  }
  function makeLoop(kind) {
    try {
      const gain = context.createGain(), filter = context.createBiquadFilter(), sources = [];
      gain.gain.value = 0; filter.type = 'lowpass'; filter.frequency.value = kind === 'tiger' ? 240 : 420;
      filter.connect(gain); gain.connect(master);
      [kind === 'tiger' ? 53 : 110, kind === 'tiger' ? 79.5 : 165].forEach(frequency => {
        const source = context.createOscillator(); source.type = 'sine'; source.frequency.value = frequency;
        source.connect(filter); source.onended = () => disconnect(source); source.start(); sources.push(source);
      });
      sources[0].onended = () => { disconnect(sources[0]); disconnect(filter); disconnect(gain); };
      return { kind, sources, gain };
    } catch (_) { return null; }
  }
  function update(info) {
    try {
      info = info || {};
      lastInfo = info;
      const nextPaused = !!info.paused;
      if (nextPaused && !paused) stopVoices(false);
      paused = nextPaused;
      if (hidden()) { quiet(); stopMusic(true); return; }
      updateMusic(info);
      if (!ready() || paused) { stopLoop(); return; }
      level(sfxLevel());
      const kind = info.state === 'taming' ? 'taming' : info.state === 'tiger' ? 'tiger' : '';
      if (!kind) { stopLoop(); return; }
      if (!loop || loop.kind !== kind) { stopLoop(); loop = makeLoop(kind); }
      if (!loop) return;
      const progress = clamp(info.progress);
      ramp(loop.gain.gain, kind === 'tiger' ? 0.012 : info.hold ? 0.02 : 0.004, 0.12);
      if (kind === 'taming') {
        ramp(loop.sources[0].frequency, 105 + progress * 20 + (info.hold ? 8 : 0), 0.1);
        ramp(loop.sources[1].frequency, 157.5 + progress * 30, 0.1);
      }
    } catch (_) { /* A failing audio backend cannot break the frame loop. */ }
  }
  function toggle() {
    enabled = !enabled;
    if (!enabled) quiet();
    else if (ready()) level(sfxLevel());
    return enabled;
  }
  function toggleMusic() {
    musicEnabled = !musicEnabled;
    if (!musicEnabled) stopMusic(true);
    else updateMusic(lastInfo);
    return musicEnabled;
  }
  function setMusicVolume(value) {
    musicVolume = clamp(value);
    if (music) updateMusic(lastInfo);
    return musicVolume;
  }
  function setSfxVolume(value) {
    sfxVolume = clamp(value);
    if (ready()) level(sfxLevel());
    return sfxVolume;
  }
  if (root.document && typeof root.document.addEventListener === 'function') {
    root.document.addEventListener('visibilitychange', () => { if (hidden()) { quiet(); stopMusic(true); } });
    root.document.addEventListener('pointerdown', unlock, { passive: true });
  }
  return { unlock, toggle, get enabled() { return enabled; }, play, update, toggleMusic, setMusicVolume, setSfxVolume, connectVoice,
    get musicEnabled() { return musicEnabled; },
    get musicVolume() { return musicVolume; },
    get sfxVolume() { return sfxVolume; },
    get musicTrack() { return music && !music.failed ? music.kind : ''; } };
}));
