(function () {
  'use strict';
  const Core = globalThis.GameCore;
  const Museum = globalThis.MuseumData;
  const Dialogue = globalThis.CuratorDialogue;
  const Voice = globalThis.CuratorVoice || { select() {}, stop() {}, pause() {}, resume() {}, replay() {}, setEnabled() {}, available: false, playing: false };
  const Sound = globalThis.GameAudio || { enabled: false, musicEnabled: false, unlock() {}, play() {}, update() {}, toggle() { return false; }, toggleMusic() { return false; } };
  const Effects = globalThis.GameEffects || { emit() {}, draw() {}, clear() {} };
  const initialSettings = Core.save.getSettings();
  if (Sound.enabled !== initialSettings.sound) Sound.toggle();
  if (typeof Sound.setMusicVolume === 'function') Sound.setMusicVolume(initialSettings.musicVolume);
  if (typeof Sound.setSfxVolume === 'function') Sound.setSfxVolume(initialSettings.sfxVolume);
  if (typeof Voice.setVolume === 'function') Voice.setVolume(initialSettings.sfxVolume);
  function toggleSound() { Sound.toggle(); Core.save.setSetting('sound', Sound.enabled); Voice.setEnabled(Sound.enabled); }
  const game = Core.createGame();
  const profile = () => Core.getProfile(game);
  const reward = () => Core.getReward(game);
  const difficultyKeys = Object.keys(Core.DIFFICULTIES);
  const modeBlurbs = {
    novice: '先练习，再挑战。20秒宽裕时间，战败不扣海贝。推荐小朋友。',
    normal: '更窄的绿区，更快的漂移。需要持续调整收放节奏。',
    veteran: '连第一匹也会挣扎。绿区狭窄，离区损失明显加重。',
    impossible: '极窄、快速、高回退。留给熟悉节奏、愿意反复挑战的人。'
  };
  const $ = id => document.getElementById(id);
  const canvas = $('scene');
  const ctx = canvas.getContext('2d');
  const keys = new Set();
  const physicalKeys = new Set();
  const names = ['初见 · 牵缰', '轻步 · 随行', '回环 · 听风', '稳缰 · 同心', '烈性 · 逐影', '疾行 · 乘风', '归位 · 成章'];
  const items = [
    { id: 'rope', name: '长缰绳', price: 20, icon: 'rope', photo: 'photoRope', label: '牵马组 · 绳索意象', effect: '稳定区宽度 +25%', note: '更宽的余地，让第一次牵缰从容一点。' },
    { id: 'bell', name: '定马铜铃', price: 25, icon: 'bell', photo: 'photoBell', label: '文物原型 · 管耳铜铃', effect: '稳定区漂移速度 −20%', note: '以铜铃为灵感，让移动的节奏慢一点。' },
    { id: 'gold', name: '剑鞘金饰', price: 35, icon: 'gold', photo: 'photoGold', label: '用户实拍 · 十二片组合', effect: '驯马基础收益 +25%', note: '金饰照亮旅程，也让之后的收获更丰厚。' },
    { id: 'sword', name: '鎏金蛇头铜剑柄', price: 65, icon: 'sword', photo: 'photoSword', label: '用户实拍 · 兵器与装饰', effect: '双虎战攻击伤害 10 → 14', note: '将剑柄造型化作攻守间的力量。' },
    { id: 'fish', name: '铜鱼杖头铜饰', price: 55, icon: 'vessel', photo: 'photoFish', label: '用户实拍 · 仪仗铜饰', effect: '每场双虎战生命 100 → 125', note: '仪仗意象带来更从容的守势。' },
    { id: 'token', name: '圆形金片饰', price: 45, icon: 'gold', photo: 'photoToken', label: '用户实拍 · 金质饰物', effect: '每匹额外 +10 海贝，可与金饰叠加', note: '为每一次人马归位添一份收获。' }
  ];
  const photoKeys = {
    container: 'photoContainer', cowrie: 'photoCowrie', bell: 'photoBell',
    gold: 'photoGold', sword: 'photoSword', fish: 'photoFish', token: 'photoToken',
    riders: 'photoRiders', armor: 'photoArmor', fork: 'photoFork', handge: 'photoHandge',
    textile: 'photoTextile', cowtiger: 'photoCowtiger', buckle: 'photoBuckle', cloud: 'photoCloud'
  };
  const ui = { overlay: null, stack: [], selection: 0, filter: '全部展品', exhibit: 'container', page: 0, shopPage: 0, lastState: 'title', lastNotice: '', lastUnlocks: 2, gate: false, padGate: false, mouseHold: false, lastPad: [], padConnected: false, padSource: false, toastUntil: 0, lastTime: 0, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
  Object.assign(ui, { errandAuto: false, errandOrigin: null, errandIndex: 0, errandTotal: 0, errandDone: 0, wipeUntil: 0 });
  Object.assign(ui, { curatorTopic: null, curatorStep: 0, curatorRecommendation: null, curatorMessage: '', curatorSource: '', pendingPurchase: null });
  Object.assign(ui, { praiseRemaining: 0, dodgeRound: 0, dodgeBattle: null });
  Object.assign(ui, { curatorMood: null, curatorState: null, curatorLastCompleted: 0, curatorThinkingUntil: 0, curatorSpeechKey: '', curatorSpeechStarted: 0, curatorSpeechUntil: 0, curatorSpeechText: '' });
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  if (typeof motionPreference.addEventListener === 'function') motionPreference.addEventListener('change', event => { ui.reduced = event.matches; updateCuratorPose(performance.now()); });
  const childEffects = {
    rope: '绿色区域变宽，更容易控制。', bell: '绿色区域移动慢一点，更好跟上。',
    gold: '之后每匹马带回的海贝更多。', sword: '双虎试炼中，每次攻击更有力。',
    fish: '双虎试炼中，你的生命更多。', token: '之后每匹马额外带回10枚海贝。'
  };
  const curatorLessons = Dialogue.lessons, curatorStories = Dialogue.stories;
  const artImages = {};
  ui.rewardUntil = 0; ui.rewardStarted = 0; ui.rewardAmount = null;
  ui.pendingChallenge = null;
  if (typeof Image === 'function' && globalThis.GameArt) {
    for (const [key, asset] of Object.entries(globalThis.GameArt)) {
      if (asset.kind === 'photo') continue;
      if (key === 'hero' && globalThis.GameArt.cover) continue;
      const image = new Image(); image.src = asset.src; artImages[key] = image;
    }
  }
  const bronze = globalThis.BronzeScene ? globalThis.BronzeScene.create({
    canvas: $('bronze-canvas'), labelCanvas: $('bronze-labels'), view: $('bronze-view'), fallbackLabel: $('bronze-fallback'), model: globalThis.GameBronzeModel,
    onSelect: index => { if (game.state === 'map' && !ui.overlay) perform('horse', { dataset: { index: String(index) } }); },
    onCenter: () => { if (game.state === 'map' && !ui.overlay) perform('shop'); }
  }) : null;
  function selectBronze(index) { if (bronze && game.state === 'map' && !ui.overlay) bronze.select(index); }
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  function feedback(type, x, y) { Sound.play(type); Effects.emit(type, x, y, ui.reduced); }
  function holdingReins() { return (keys.has('Space') && !ui.gate) || ui.mouseHold || (!!ui.lastPad[0] && !ui.padGate); }
  function observationMarkup(exhibit) {
    const clue = exhibit.tamingClue;
    return clue ? `<div class="observation-clue"><b>观察后再试</b><p>${escape(clue.observation)}</p><p>${escape(clue.playHint)}</p></div>` : '';
  }
  function attackTiger() { if (Core.attack(game)) { feedback('attack', 425, 365); if (game.tiger.result === 'success') feedback('success', 425, 365); } }
  function dodgeTiger() {
    if (Core.dodge(game)) {
      if (game.tiger.dodged) { Sound.play('parry'); Effects.emit('counter', 425, 378, ui.reduced); }
      else feedback('hit', 425, 378);
      if (game.tiger.result === 'success') feedback('success', 425, 365);
    }
  }
  const shown = (id, show) => { const el = $(id); if (el) el.classList.toggle('hidden', !show); };
  function toast(message) {
    if (!message) return;
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    ui.toastUntil = performance.now() + 3500;
  }
  function clearReward() {
    ui.rewardUntil = 0; ui.rewardAmount = null;
    $('reward-card').classList.add('hidden');
    ['cowries', 'count', 'collection-count', 'score'].forEach(id => $(id).classList.remove('reward-pop'));
  }
  function celebrate({ kind = 'horse', title, detail, amount = null, count = game.completed.filter(Boolean).length, score = null, grade = '' }) {
    const now = performance.now(), card = $('reward-card');
    const centered = kind === 'purchase' || kind === 'collection' || kind === 'victory';
    ui.rewardStarted = now; ui.rewardUntil = now + (kind === 'victory' ? 5200 : kind === 'horse' ? 3800 : 3000); ui.rewardAmount = amount;
    card.className = `reward-card${centered ? ' reward-centered' : ''}`;
    card.dataset.kind = kind;
    card.innerHTML = `${ui.reduced ? '' : `<div class="reward-sparkles" aria-hidden="true">${Array.from({length: 18}, (_, i) => `<i style="--x:${(i - 8.5) * 29}px;--d:${i % 5 * .07}s;--r:${i * 37}deg"></i>`).join('')}</div>`}<span class="reward-seal" aria-hidden="true"><svg viewBox="0 0 48 48" fill="currentColor"><path d="m24 4 6 12 14 2-10 10 2 14-12-7-12 7 2-14L4 18l14-2z"/></svg></span><p class="reward-kicker">${kind === 'purchase' ? '新道具加入！' : kind === 'collection' ? '发现新宝藏！' : kind === 'victory' ? '七组全部归位！' : '你又做到了！'}</p><h2>${escape(title)}</h2><p class="reward-description">${escape(detail)}</p>${amount !== null ? `<span class="sr-only">获得${amount}枚海贝。</span><p class="reward-amount" aria-hidden="true">+<span id="reward-number">${ui.reduced ? amount : 0}</span><small>海贝</small></p>` : ''}${score !== null ? `<p class="reward-score">本匹评分 <b>${score}</b> 分 · <span class="grade grade-${escape(grade)}">${escape(grade)}</span></p>` : ''}${kind === 'horse' || kind === 'victory' ? `<div class="reward-stamps" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => `<span class="${i < count ? 'earned' : ''}">${i < count ? '★' : i + 1}</span>`).join('')}</div><p class="reward-progress">已经完成 ${count} / 7 组${count < 7 ? ' · 一步一步，你真棒！' : ' · 每一颗星，都是你的努力！'}</p>` : ''}<p id="reward-collection" class="reward-collection"></p><p class="reward-auto">自动收起，可以继续游玩</p>`;
    Effects.emit(kind === 'horse' || kind === 'victory' ? 'reward' : 'gift', centered ? 640 : 436, 360, ui.reduced);
    Sound.play(kind === 'horse' ? 'reward' : kind === 'collection' ? 'collect' : kind === 'victory' ? 'victory' : 'coin');
    if (amount !== null) $('cowries').classList.add('reward-pop');
    if (score !== null) $('score').classList.add('reward-pop');
    $('count').classList.add('reward-pop');
    updateHud();
  }
  function flushInputs() {
    keys.clear(); ui.mouseHold = false; ui.gate = true; ui.padGate = true;
  }
  function icon(kind) {
    const shapes = {
      vessel: '<ellipse cx="50" cy="25" rx="30" ry="9"/><path d="M20 25v42q30 18 60 0V25M20 37q30 15 60 0M20 58q30 15 60 0M29 74v8m42-8v8M19 40q-15-13-11 7t12 10m60-17q15-13 11 7T80 57"/><path d="M35 21l6-8 8 8 10-9 7 10"/>',
      cowrie: '<ellipse cx="50" cy="48" rx="24" ry="34" transform="rotate(25 50 48)"/><path d="M65 20Q38 42 36 76m20-46 8 4M49 39l9 4m-15 5 10 4m-15 6 10 3m-12 7 7 2"/>',
      bell: '<path d="M30 29V16q0-7 7-7t7 7v11m12 0V16q0-7 7-7t7 7v13M30 29q20-9 40 0l7 42q-27 17-54 0zM24 63q26 13 52 0m-27-19 1 26m-3 10v7"/>',
      rope: '<path d="M62 18q-35-8-37 17t38 15q17-6 8-20T43 22q-14 12 4 23m5 6q-24 9-21 25t31 4q18-13-1-20m-1 9 21 14"/><path d="M26 31l43 3M32 22l28 27" opacity=".45"/>',
      gold: '<path d="M22 20l13 22H9zm29 0 13 22H38zm29 0 13 22H67zM22 48l13 22H9zm29 0 13 22H38zm29 0 13 22H67zM22 76l7 12H15zm29 0 7 12H44zm29 0 7 12H73z"/>',
      armor: '<path d="M32 13q19-8 38 0L63 83q-13 8-27 0zM41 16l3 65m15-65-5 65M31 26l37 0m-35 14h34m-32 15h30m-29 15h27"/>',
      fork: '<path d="M44 88V49L22 22l6-12 22 26L72 10l6 12-22 27v39M36 31l14-8 14 8m-26 5 12 10 12-10"/>',
      sword: '<path d="M46 82l-5-38-6-13 8-20 7 8 7-8 8 20-6 13-5 38zM35 49h30M44 26l6 7 6-7m-6 9v43"/>',
      ge: '<path d="M28 84l16-50 5-4 15 9 20-8-7-8-26-8-11 9-8 9-9 6m21-5 23 6M20 42l21-6m0-12-16 4"/>',
      drum: '<ellipse cx="50" cy="37" rx="31" ry="11"/><path d="M19 37l8 31q23 12 46 0l8-31M28 51q22 9 44 0M36 31l1-18 10 5v12m7 2 1-19 10 5v13M27 68v10m46-10v10"/>',
      buckle: '<rect x="18" y="28" width="64" height="41" rx="13"/><path d="M27 48q24-38 46 0-24 36-46 0zm15-4 8-9 8 9-8 15zM18 37l-8 10 8 12m64-22 8 10-8 12"/>',
      cloud: '<rect x="13" y="23" width="74" height="52" rx="8"/><path d="M24 34q0-10 10-7t1 15-8 10 10 10m15-25q-8-13-15-3t12 11 2 19m16-30q11 0 9 10t-15 2 0 17m-38 2 7-7 7 7m30-2 6-7 6 7"/>',
      cowtiger: '<path d="M18 46q8-22 45-13l10 10 11-2 3 14-12 9-8-11-13 3-25-1-3 26m33-25 5 25M19 44l-8-14 7-5 7 9m48 9 9-22-12 10M33 57l5 10 15 0 4-11"/>',
      textile: '<path d="M16 21v59m68-59v59M16 36h68M16 68h68M30 38v29m10-29v29m10-29v29m10-29v29m10-29v29M22 49h56m-56 9h56M40 30l10-15 10 15"/>'
    };
    return `<svg viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shapes[kind] || shapes.vessel}</svg>`;
  }
  function overlayHeader(eyebrow, title, extra = '') {
    return `<header class="modal-header"><div><p class="eyebrow">${eyebrow}</p><h2 id="modal-title">${title}</h2></div><div>${extra}<button class="close-button" data-act="close" aria-label="关闭">×</button></div></header>`;
  }
  function photoMarkup(key, label) {
    const asset = globalThis.GameArt && globalThis.GameArt[key];
    if (!asset) return icon('vessel');
    const crop = asset.crop || [0, 0, asset.width, asset.height];
    return `<svg class="artifact-photo" data-photo="${key}" viewBox="${crop.join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escape(label)}，${escape(asset.photoLabel || '实拍照片')}"><image href="${asset.src}" x="0" y="0" width="${asset.width}" height="${asset.height}"/></svg>`;
  }
  function photoCreditMarkup(key) {
    const asset = globalThis.GameArt && globalThis.GameArt[key];
    if (!asset || !asset.credit) return '';
    const credit = asset.sourceUrl ? `<a href="${escape(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(asset.credit)}</a>` : escape(asset.credit);
    const license = asset.licenseUrl ? ` · <a href="${escape(asset.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escape(asset.license)}</a> · 显示裁边` : '';
    return `<p class="photo-credit">${escape(asset.photoLabel)}<br>${credit}${license}${asset.qualityNote ? `<br><span class="photo-quality-note">${escape(asset.qualityNote)}</span>` : ''}</p>`;
  }
  function overlayFooter(left, right = '方向键选择 · 空格 / A 确认 · Shift / B 返回') {
    return `<div class="modal-footer"><span>${left}</span><span>${right}</span></div>`;
  }
  function volumeMarkup() {
    const rows = [
      { key: 'music', label: '背景音乐', act: 'music', enabled: Sound.musicEnabled, value: Number.isFinite(Sound.musicVolume) ? Sound.musicVolume : 1 },
      { key: 'sfx', label: '音效与配音', act: 'sound', enabled: Sound.enabled, value: Number.isFinite(Sound.sfxVolume) ? Sound.sfxVolume : 1 }
    ];
    return `<section class="settings-group sound-group" role="group" aria-label="声音与音量">
      <p class="group-title"><span>声音与音量</span><small>SOUND</small></p>` + rows.map(row => {
      const percent = Math.round(row.value * 100);
      return `<div class="volume-row" data-muted="${!row.enabled}">
        <span class="volume-label">${row.label}</span>
        <input id="volume-${row.key}" type="range" min="0" max="100" step="5" value="${percent}" data-volume="${row.key}" aria-label="${row.label}音量" aria-valuetext="${percent}%">
        <b id="volume-${row.key}-value" class="volume-value">${percent}%</b>
        <button class="sound-toggle" data-act="${row.act}" aria-pressed="${row.enabled}" aria-label="${row.label}，${row.enabled ? '已开启，点击关闭' : '已关闭，点击开启'}">${row.enabled ? '开' : '关'}</button>
      </div>`;
    }).join('') + `<p class="volume-note">拖动滑杆调节音量，右侧开关可一键静音；设置会自动保存。</p></section>`;
  }
  function resetCurator() {
    Voice.stop();
    ui.curatorTopic = null; ui.curatorStep = 0; ui.curatorRecommendation = null;
    ui.curatorQuizAnswers = []; ui.curatorItem = null; ui.curatorItemMode = 'history';
    ui.curatorMessage = ''; ui.curatorSource = ''; ui.pendingPurchase = null;
    ui.curatorMood = null; ui.curatorThinkingUntil = 0; ui.curatorSpeechKey = ''; ui.curatorSpeechUntil = 0;
  }
  function curatorPose(now) {
    if (ui.pendingPurchase || (ui.curatorTopic === 'choose' && now < ui.curatorThinkingUntil)) return 'thinking';
    if (ui.curatorTopic === 'quiz' && ui.curatorQuizAnswers[ui.curatorStep] !== undefined) return ui.curatorQuizAnswers[ui.curatorStep] === Dialogue.quizzes[ui.curatorStep]?.answer ? 'celebrating' : 'encouraging';
    if (['help', 'story', 'item', 'quiz'].includes(ui.curatorTopic) || (ui.curatorTopic === 'choose' && ui.curatorRecommendation)) return 'explaining';
    if (ui.curatorTopic === 'choose') return 'encouraging';
    if (ui.curatorMood) return ui.curatorMood;
    if (game.retryProgress.some(value => value > 0)) return 'encouraging';
    return game.completed.every(Boolean) ? 'celebrating' : 'welcome';
  }
  function beginCuratorSpeech(now) {
    ui.curatorSpeechStarted = now;
    ui.curatorSpeechUntil = now + Math.min(5500, 1000 + ui.curatorSpeechText.length * 65);
  }
  function updateCuratorPose(now) {
    if (ui.overlay !== 'shop') { Voice.pause(); return; }
    Voice.setEnabled(Sound.enabled);
    if (ui.pendingPurchase) Voice.pause();
    const actor = $('curator-actor');
    if (!actor) return;
    const state = curatorPose(now);
    if (state !== ui.curatorState && state === 'explaining') beginCuratorSpeech(now);
    ui.curatorState = state;
    if (actor.dataset.state !== state) actor.dataset.state = state;
    const facing = ['welcome', 'encouraging', 'celebrating'].includes(state) ? 'front' : state === 'thinking' ? 'three-quarter' : 'side';
    if (actor.dataset.facing !== facing) actor.dataset.facing = facing;
    const speaking = Voice.available ? Voice.playing : now < ui.curatorSpeechUntil;
    const mouth = !ui.reduced && state === 'explaining' && speaking && Math.floor((now - ui.curatorSpeechStarted) / 170) % 2 === 0 ? 'open' : 'closed';
    if (actor.dataset.mouth !== mouth) actor.dataset.mouth = mouth;
    const labels = { welcome: '和你打个招呼', explaining: '听馆长慢慢讲', thinking: '让我想一想', encouraging: '我们一起再试试', celebrating: '为你的进步喝彩' };
    if ($('curator-state-label').textContent !== labels[state]) {
      $('curator-state-label').textContent = labels[state];
      actor.setAttribute('aria-label', `馆长：${labels[state]}，点击打个招呼`);
    }
    const voiceToggle = $('curator-voice-toggle'), voiceStatus = $('curator-voice-status');
    if (voiceToggle && Voice.available) {
      voiceToggle.textContent = Voice.playing ? '暂停' : '播放';
      voiceToggle.setAttribute('aria-label', Voice.playing ? '暂停馆长配音' : '播放馆长配音');
      if (voiceStatus) voiceStatus.textContent = !Sound.enabled ? '声音已关闭' : Voice.error ? '点播放听讲解' : Voice.playing ? '馆长正在讲' : '馆长 AI 配音';
      const mute = $('curator-voice-mute');
      if (mute) { mute.textContent = Sound.enabled ? '静音' : '开声音'; mute.setAttribute('aria-pressed', String(!Sound.enabled)); }
    }
  }
  function curatorArtMarkup() {
    const art = globalThis.GameArt || {}, atlas = art.curatorStates, closed = art.curatorClosed || art.curator;
    let layers = '';
    if (atlas) for (const [state, crop] of Object.entries(atlas.frames)) {
      layers += `<svg class="curator-layer" data-pose="${state}" viewBox="${crop.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><image href="${atlas.src}" width="${atlas.width}" height="${atlas.height}"/></svg>`;
    }
    if (closed) layers += `<img class="curator-layer" data-pose="explaining" src="${closed.src}" alt="" aria-hidden="true" width="1024" height="1536">`;
    // Only the mouth region alternates, so generated variations elsewhere in
    // the two source images cannot make the head or clothing flicker.
    if (art.curator) layers += `<svg class="curator-mouth" viewBox="0 0 1024 1536" aria-hidden="true"><defs><clipPath id="curator-mouth-mask"><ellipse cx="650" cy="544" rx="48" ry="25"/></clipPath></defs><image href="${art.curator.src}" width="1024" height="1536" clip-path="url(#curator-mouth-mask)"/></svg>`;
    return `<span class="curator-body" aria-hidden="true">${layers}</span>`;
  }
  function curatorGreeting() {
    const count = game.completed.filter(Boolean).length;
    if (game.state === 'title') return Dialogue.lines.welcome_title;
    if (count === 7) return Dialogue.lines.welcome_complete;
    if (game.retryProgress.some(value => value > 0)) return Dialogue.lines.welcome_retry;
    if (count) return `欢迎回来！你已经让${count}组人马归位了。想聊文物，还是一起挑道具？`;
    return Dialogue.lines.welcome_first;
  }
  function recommendItem() {
    if (game.state !== 'map' || game.completed.every(Boolean)) return null;
    const count = game.completed.filter(Boolean).length;
    const order = count >= 3 ? ['rope', 'bell', 'fish', 'sword', 'gold', 'token'] : ['rope', 'bell', 'gold', 'token', 'fish', 'sword'];
    return order.find(id => !game.upgrades[id] && game.cowries >= items.find(item => item.id === id).price) || null;
  }
  function curatorMarkup() {
    let message = ui.curatorMessage || curatorGreeting(), source = ui.curatorSource, actions = '';
    if (ui.curatorTopic === 'help') {
      message = curatorLessons[ui.curatorStep];
      source = `一起学驯马 · ${ui.curatorStep + 1} / ${curatorLessons.length}`;
      if (ui.curatorStep < curatorLessons.length - 1) actions += '<button class="primary" data-act="curator-next">下一步 <span>→</span></button>';
      else actions += '<button class="primary" data-act="curator-chat">我有点卡住，聊聊吧 <span>→</span></button>';
    } else if (ui.curatorTopic === 'story') {
      message = curatorStories[ui.curatorStep].text;
      source = '馆方资料小讲解 · ' + (ui.curatorStep + 1) + ' / ' + curatorStories.length;
      if (ui.curatorStep < curatorStories.length - 1) actions += `<button class="primary" data-act="curator-next">${ui.curatorStep === 0 ? '我数好了，听答案' : '再听一个'} <span>→</span></button>`;
      actions += '<button class="secondary" data-act="curator-exhibit">带我看看文物 <span>↗</span></button>';
      if (ui.curatorStep === curatorStories.length - 1) actions = '<button class="primary" data-act="curator-quiz">馆长，考考我吧 <span>→</span></button>' + actions;
    } else if (ui.curatorTopic === 'quiz') {
      const quiz = Dialogue.quizzes[ui.curatorStep], answer = ui.curatorQuizAnswers[ui.curatorStep];
      source = `文物小问答 · ${Math.min(ui.curatorStep + 1, Dialogue.quizzes.length)} / ${Dialogue.quizzes.length}`;
      if (!quiz) {
        message = Dialogue.lines.quiz_done;
        actions += '<button class="primary" data-act="curator-exhibit">再看看文物 <span>↗</span></button>';
      } else if (answer === undefined) {
        message = Dialogue.lines[quiz.question];
        actions += '<div class="curator-choices" role="group" aria-label="选择你的答案">' + quiz.choices.map((choice, index) => `<button class="secondary" data-act="curator-answer" data-id="${index}">${choice}</button>`).join('') + '</div>';
        actions += '<button class="secondary" data-act="curator-exhibit">先观察一下 <span>↗</span></button>';
      } else {
        message = Dialogue.lines[answer === quiz.answer ? quiz.right : quiz.wrong];
        source += ` · 你选了${quiz.choices[answer]}`;
        actions += `<button class="primary" data-act="curator-quiz-next">${ui.curatorStep === Dialogue.quizzes.length - 1 ? '我记住啦' : '再猜一题'} <span>→</span></button>`;
        actions += '<button class="secondary" data-act="curator-exhibit">带我看看答案里的文物 <span>↗</span></button>';
      }
    } else if (ui.curatorTopic === 'item') {
      const item = items.find(item => item.id === ui.curatorItem);
      const exhibit = Museum.entries.find(entry => entry.id === (item.id === 'rope' ? 'container' : item.id));
      message = ui.curatorItemMode === 'history' ? exhibit.purchaseIntro : Dialogue.lines[game.upgrades[item.id] ? 'effect_owned' : 'effect_' + item.id];
      source = ui.curatorItemMode === 'history' ? '文物原型 · ' + exhibit.sourceType : `游戏创作 · ${item.price}枚海贝${game.upgrades[item.id] ? ' · 已拥有' : ''}`;
      actions += `<button class="primary" data-act="curator-item-mode">${ui.curatorItemMode === 'history' ? '这件适合我吗？' : '它有什么来历？'} <span>→</span></button><button class="secondary" data-act="curator-item-exhibit">带我看文物原型 <span>↗</span></button>`;
    } else if (ui.curatorTopic === 'chat') {
      const count = game.completed.filter(Boolean).length;
      const key = game.state === 'title' ? 'title' : count === 7 ? 'complete' : game.retryProgress.some(value => value > 0) ? 'retry' : game.tigerChapterUsed ? 'tiger' : count ? 'progress' : 'first';
      message = Dialogue.lines['chat_' + key]; source = '馆长陪你聊 · 慢慢来';
      actions += '<button class="secondary" data-act="curator-topic" data-id="help">再教我一次玩法 <span>→</span></button><button class="primary" data-act="curator-quiz">换个轻松话题，猜文物 <span>→</span></button>';
    } else if (ui.curatorTopic === 'choose') {
      const id = ui.curatorRecommendation, count = game.completed.filter(Boolean).length;
      if (id) {
        const item = items.find(item => item.id === id);
        message = `可以看看${item.name}，需要${item.price}枚海贝。${childEffects[id]}`;
        source = '馆长的小建议 · 你来决定';
        actions += '<button class="primary" data-act="curator-recommend">看看这件道具 <span>→</span></button>';
      } else if (game.state === 'title') message = '先开始游戏、和马儿交个朋友吧！收集到海贝后，我再陪你挑道具。';
      else if (count === 7) message = '这次挑战已经完成啦！现在可以一起看看图鉴，发现更多文物细节。';
      else if (Object.values(game.upgrades).every(Boolean)) message = '道具已经集齐啦！带上它们，继续和马儿练习吧。';
      else message = '先把海贝留好，回去和下一匹马试试看。等攒够了，我们再一起挑！';
    }
    if (ui.curatorTopic) actions += '<button class="secondary" data-act="curator-home">换个话题 <span>↩</span></button>';
    else actions = '<button class="secondary" data-act="curator-topic" data-id="help">怎么玩呀？ <span>→</span></button><button class="secondary" data-act="curator-topic" data-id="story">讲件文物吧 <span>→</span></button><button class="secondary" data-act="curator-topic" data-id="choose">帮我选一件吧！ <span>→</span></button><div class="curator-shortcuts"><button class="secondary" data-act="curator-quiz">一起猜文物</button><button class="secondary" data-act="curator-chat">聊聊挑战</button></div>';
    const key = `${ui.curatorTopic}:${ui.curatorStep}:${message}`;
    if (key !== ui.curatorSpeechKey) { ui.curatorSpeechKey = key; ui.curatorSpeechText = message; beginCuratorSpeech(performance.now()); }
    Voice.setEnabled(Sound.enabled); Voice.select(message);
    const controls = Voice.available ? '<div class="curator-audio"><span id="curator-voice-status">馆长 AI 配音</span><button id="curator-voice-toggle" data-act="curator-voice-toggle" aria-label="暂停馆长配音">暂停</button><button data-act="curator-voice-replay" aria-label="重听本段馆长配音">重听</button><button id="curator-voice-mute" data-act="curator-voice-mute" aria-label="切换馆长配音和音效" aria-pressed="' + String(!Sound.enabled) + '">' + (Sound.enabled ? '静音' : '开声音') + '</button></div>' : '';
    return `<aside class="curator-panel${Voice.available ? ' has-voice' : ''}" aria-label="与博物馆馆长互动"><button id="curator-actor" class="curator-portrait" data-act="curator-home" data-state="${curatorPose(performance.now())}" data-mouth="closed" aria-label="和馆长打个招呼">${curatorArtMarkup()}<span class="curator-name">博物馆馆长<small id="curator-state-label">陪你发现文物里的故事</small></span></button><div class="curator-speech" role="status" aria-live="polite" aria-atomic="true"><p>${escape(message)}</p>${source ? `<small>${escape(source)}</small>` : ''}</div>${controls}<div class="curator-actions${ui.curatorTopic ? '' : ' home-topics'}">${actions}</div></aside>`;
  }
  function purchaseMarkup() {
    const item = items.find(item => item.id === ui.pendingPurchase);
    if (!item) return '';
    return `<div class="purchase-shade"><div class="purchase-prompt" role="group" aria-label="确认购买"><div><p class="eyebrow">馆长帮你算一算</p><h3>要带走${item.name}吗？</h3><p>花费 <b>${item.price}</b> 枚海贝，还剩 <b>${game.cowries - item.price}</b> 枚。</p></div><div class="purchase-actions"><button class="primary" data-act="purchase-confirm">确认购买 <span>✓</span></button><button class="secondary" data-act="purchase-cancel">再想一想 <span>↩</span></button></div></div></div>`;
  }
  function focusFirst() {
    const scope = ui.overlay ? $('modal') : game.state === 'title' ? $('title-screen') : game.state === 'archive' ? $('archive-screen') : $('map-panel');
    if (!ui.overlay && game.state === 'map') {
      const target = ui.selection === 7 ? scope.querySelector('#map-shop') : scope.querySelector('#start-horse:not(:disabled)') || scope.querySelector('[data-act="horse"].selected');
      if (target) target.focus({ preventScroll: true });
      return;
    }
    const selector = ui.overlay === 'errand' ? `[data-act="errand-select"][data-id="${Core.ERRANDS[ui.errandIndex].id}"]` : ui.overlay === 'shop' ? ui.pendingPurchase ? '[data-act="purchase-cancel"]' : ui.curatorTopic ? '.curator-actions button' : '[data-act="curator-topic"],.curator-actions button' : '';
    // 设置等弹窗优先聚焦主操作按钮，避免手柄一进来按 A 就误关弹窗。
    const target = ui.overlay === 'ready' ? scope.querySelector('[data-act="ready-start"]')
      : selector ? scope.querySelector(selector)
      : scope.querySelector('button.primary:not(:disabled)') || scope.querySelector('button:not(:disabled):not(.close-button)') || scope.querySelector('button:not(:disabled)');
    if (target) target.focus({ preventScroll: true });
  }
  function resetWipeConfirmation() {
    ui.wipeUntil = 0;
    const button = $('wipe-save');
    if (button) button.textContent = '清空家业与设置';
  }
  function openOverlay(type) {
    if (ui.overlay === type) return;
    resetWipeConfirmation();
    clearReward();
    if (type === 'ready' || type === 'endless') { $('toast').classList.remove('visible'); ui.toastUntil = 0; }
    Sound.play(type === 'pause' ? 'pause' : 'ui');
    Sound.update({state:game.state,overlay:type,paused:true,hold:false,progress:0,duck:Voice.playing});
    ui.stack.push(ui.overlay); ui.overlay = type;
    if (type === 'shop') {
      ui.shopPage = 0; resetCurator();
      const count = game.completed.filter(Boolean).length;
      if (count > ui.curatorLastCompleted && !game.retryProgress.some(value => value > 0)) ui.curatorMood = 'celebrating';
      ui.curatorLastCompleted = count;
    }
    game.paused = type !== 'shop';
    flushInputs(); renderModal();
  }
  function openErrands(origin = null) {
    if (game.state !== 'map' || game.pendingErrands <= 0 || ui.overlay === 'errand') return;
    ui.errandOrigin = origin; ui.errandAuto = false;
    ui.errandIndex = 0; ui.errandTotal = game.pendingErrands; ui.errandDone = 0;
    openOverlay('errand');
  }
  function closeOverlay() {
    if (ui.overlay === 'endless') return;
    if (ui.overlay === 'pause') resetWipeConfirmation();
    if (ui.overlay === 'errand') { ui.errandAuto = false; ui.errandOrigin = null; }
    if (ui.overlay === 'shop' && ui.pendingPurchase) { ui.pendingPurchase = null; flushInputs(); renderModal(); return; }
    if (ui.overlay === 'shop' && ui.curatorTopic) { resetCurator(); flushInputs(); renderModal(); return; }
    if (ui.overlay === 'ready') {
      if (ui.pendingChallenge && ui.pendingChallenge.type === 'tiger') { openOverlay('pause'); return; }
      ui.pendingChallenge = null;
    }
    Sound.play('ui');
    ui.overlay = ui.stack.pop() || null;
    game.paused = !!ui.overlay && ui.overlay !== 'shop';
    flushInputs(); renderModal(); updateViews();
  }
  function clearOverlays() {
    resetWipeConfirmation();
    ui.overlay = null; ui.stack = []; game.paused = false;
    $('modal-backdrop').classList.add('hidden'); flushInputs();
  }
  function renderModal() {
    if (ui.overlay !== 'shop') Voice.pause();
    shown('modal-backdrop', !!ui.overlay);
    if (!ui.overlay) { focusFirst(); return; }
    const modal = $('modal');
    modal.className = 'modal';
    if (ui.overlay === 'endless') {
      modal.classList.add('endless-modal');
      const done = game.state === 'endless-result', retry = game.state === 'endless-retry';
      const record = Core.getEndlessRecord(game), best = Core.save.getEndlessBest()[game.difficulty];
      const heading = done ? '无尽挑战结算' : retry ? '守关未过，再试一次' : `第${game.endlessRound}轮 · 守关成功`;
      const lead = done ? game.endReason === 'courage' ? '三格勇气已用尽。这次走过的路，已经记下。' : '收官成功，纪录已保存。随时可以再来挑战。' : retry ? '七匹马仍然归位，海贝和道具都保留。赢下守关双虎，就能进入下一轮。' : '海贝、道具与图鉴跨轮保留，下一轮马儿与双虎会更难。';
      modal.innerHTML = `<header class="modal-header"><div><p class="eyebrow">无尽挑战 · ${escape(profile().name)}</p><h2 id="modal-title">${heading}</h2></div></header>` +
        `<div class="modal-body endless-body"><p class="endless-lead">${lead}</p><div class="endless-summary"><div><span>完成轮数</span><strong>${game.endlessRounds}</strong></div><div><span>剩余勇气</span><strong>${game.courage}<small> / 3</small></strong></div><div><span>持有海贝</span><strong>${game.cowries}</strong></div></div><p class="endless-record">本次 ${record.rounds}轮 + ${record.horses}匹 · 个人最佳 ${best.rounds}轮 + ${best.horses}匹${game.endlessNewBest ? ' · 刷新纪录！' : ''}</p><p class="muted">累计评分 ${Core.scoreBreakdown(game).total} · 击退双虎 ${game.tigerWins} 次<br>纪录按完成轮数、额外归位马数比较，普通通关评分独立保存。</p><div class="endless-actions"><button class="primary" data-act="${done ? 'new' : retry ? 'endless-retry' : 'endless-next'}">${done ? '再来一局无尽' : retry ? '再战守关双虎' : `继续第${game.endlessRound + 1}轮`} <span>→</span></button><button class="secondary" data-act="${done ? 'title' : 'endless-finish'}">${done ? '返回标题' : '收官并保存纪录'}</button>${done ? '<button class="text-button" data-act="museum">查看本局图鉴</button>' : ''}</div></div>` + overlayFooter('轮间和结算不会消耗时间。勇气只在双虎战败时扣除。', '方向键选择 · 空格 / A 确认 · Esc / START 暂停');
    } else if (ui.overlay === 'ready') {
      modal.classList.add('ready-modal');
      const tiger = ui.pendingChallenge && ui.pendingChallenge.type === 'tiger';
      const timeoutTiger = tiger && game.tiger && game.tiger.trigger === 'timeout';
      const finalTiger = tiger && game.tiger && game.tiger.trigger === 'finale';
      const attackCount = tiger ? game.tiger.strikes.length : 0;
      const index = ui.pendingChallenge ? ui.pendingChallenge.index : ui.selection;
      modal.innerHTML = overlayHeader(tiger ? (finalTiger ? '七马归位 · 高难度双虎终战' : timeoutTiger ? '器耳双虎 · 超时试炼' : '器耳双虎 · 章节试炼') : `第 ${index + 1} 组 · ${profile().name}`, tiger ? '看清招式，再迎战！' : '准备好牵起缰绳了吗？') +
        `<div class="ready-body"><p class="ready-title">${tiger ? `${attackCount}道攻击同时逼近，按编号依次闪避` : escape(names[index])}</p><div class="ready-tips">${tiger ? '<p><kbd>A / 空格</kbd><span>挥击双虎，两虎休整时抓紧反击</span></p><p><kbd>B / Shift</kbd><span>对应光圈进入绿环时闪避；松开再按躲下一击</span></p>' : '<p><kbd>按住 A / 空格</kbd><span>收紧缰绳，让指针上升</span></p><p><kbd>松开</kbd><span>放松缰绳，让指针下降；留在绿区就能归位</span></p>'}</div><p class="ready-safety">准备页不会计时${tiger ? '，也不会掉血' : ''}。慢慢看，准备好了再确认。</p><button class="primary wide" data-act="ready-start">${tiger ? '我准备好了 · 迎战双虎' : '我准备好了 · 开始驯马'} <kbd>空格 / A</kbd></button><p class="small muted">确认后先松开按键，再开始操作。</p></div>` + overlayFooter(tiger ? (finalTiger ? game.mode === 'endless' ? '无尽守关：获胜才计完成一轮，战败扣一格勇气' : '至少老手强度；终战结束后开启档案，新手战败不扣海贝' : timeoutTiger ? '超时保留的进度已记录，海贝不受影响' : '归位奖励已到账，庆祝效果已收起') : 'B / Shift 返回选马', tiger ? 'START / Esc 暂停与说明' : 'START / Esc 暂停与说明');
    } else if (ui.overlay === 'errand') {
      modal.classList.add('errand-modal');
      const levels = Core.save.getIndustry();
      modal.innerHTML = overlayHeader(`第 ${ui.errandDone + 1} / ${ui.errandTotal} 件 · 三选一`, '头领的差事') +
        `<div class="errand-body"><p class="errand-intro">选一件来帮忙，家业会慢慢成长。</p><div class="industry-levels">${Core.ERRANDS.map(item => `<span>${item.industry} Lv${levels[item.id]}</span>`).join('')}</div><div class="errand-grid">` + Core.errandOptions(game).map((item, index) =>
          `<button class="errand-card ${index === ui.errandIndex ? 'chosen' : ''}" data-act="errand-select" data-id="${item.id}" aria-pressed="${index === ui.errandIndex}"><span class="errand-order">差事 ${index + 1}</span><strong>${item.name}</strong><span>${item.description}</span><b class="errand-effect">${item.effect}</b><span class="errand-level">${item.industry} Lv${item.level}${item.full ? ' · 已满级' : ` → Lv${item.nextLevel}`}</span><span class="errand-preview">${item.preview}${item.full ? ' · 即时效果照常获得' : ' · 永久生效'}</span></button>`
        ).join('') + `</div><p class="errand-note">差事与产业效果为游戏创作。</p><button class="text-button" data-act="close">稍后办理 · 待办会保留</button></div>` + overlayFooter(`已开局 ${Core.save.getStats().runs} 次 · 累计办理 ${Core.save.getStats().decisions} 件 · 家业跨局保留`, '← → 选择差事 · 空格 / A 确认 · Shift / B 稍后');
    } else if (ui.overlay === 'difficulty') {
      modal.classList.add('difficulty-modal');
      modal.innerHTML = overlayHeader(game.mode === 'endless' ? '无尽挑战 · 七马一轮 · 三格勇气' : '牵缰之前 · 选择你的挑战', '四种难度，四种节奏') +
        '<div class="modal-body difficulty-grid">' + difficultyKeys.map((id, index) => {
          const p = Core.DIFFICULTIES[id];
          return `<button class="difficulty-card ${game.difficulty === id ? 'chosen' : ''}" data-act="difficulty-select" data-id="${id}" aria-pressed="${game.difficulty === id}" tabindex="-1"><span class="mode-order">0${index + 1} / CHALLENGE</span><span class="mode-name">${p.name}</span><span class="mode-blurb">${modeBlurbs[id]}</span><span class="mode-reward"><b>${p.reward}</b>海贝 / 匹</span></button>`;
        }).join('') + '</div>' + `<div class="difficulty-confirm"><p>${game.mode === 'endless' ? '每轮七马，再战高难度双虎；胜利才进入下一轮。<br>虎战战败扣一格勇气；海贝与道具跨轮保留，永久产业不参与。' : '本局开始后难度锁定 · 不同马匹仍会逐渐变难<br>驯马超时会立刻引来双虎；第4匹章节战，第7匹高难度终战。'}</p><button class="primary" data-act="new">以${profile().name}难度开始 <span>→</span></button></div>` + overlayFooter('← → / 十字键切换难度 · 空格 / A 开始', 'Shift / B 返回');
    } else if (ui.overlay === 'shop' && game.mode === 'endless' && ui.shopPage === 2) {
      modal.classList.add('shop-modal');
      modal.innerHTML = overlayHeader('本局海贝 · 为下一次挑战准备', '无尽续战补给', `<span class="modal-label">我的海贝 <b>${game.cowries}</b> 枚</span>`) +
        `<div class="modal-body supply-body"><p class="endless-lead">补给只作用于下一次挑战，每种最多备一份。勇气不能购买。</p><div class="supply-grid"><article><p class="eyebrow">下一次训练</p><h3>备战草料</h3><p>稳定区扩大15%，开训时使用。</p><button class="primary" data-act="supply" data-id="forage" ${game.forageBuff > 1 || game.cowries < 25 ? 'disabled' : ''}>${game.forageBuff > 1 ? '已备好一份' : '准备草料 · 25海贝'}</button></article><article><p class="eyebrow">下一场双虎</p><h3>护身符</h3><p>抵挡一次伤害，进入虎战时携带。</p><button class="primary" data-act="supply" data-id="shield" ${game.endlessShield || game.cowries < 35 ? 'disabled' : ''}>${game.endlessShield ? '已备好一份' : '准备护符 · 35海贝'}</button></article></div><p class="muted">道具为游戏创作；使用后可再次购买，不能囤积叠加。</p></div>` + overlayFooter('3 / 3 · 无尽模式专属', '<button data-act="shop-page" data-step="-1">← 上一页</button><small>Shift / B 返回地图</small>');
    } else if (ui.overlay === 'shop') {
      modal.classList.add('shop-modal');
      const visibleItems = items.slice(ui.shopPage * 3, ui.shopPage * 3 + 3);
      modal.innerHTML = overlayHeader('和馆长一起 · 发现与收获', '贝币商店', `<span class="modal-label">我的海贝 <b>${game.cowries}</b> 枚</span>`) +
        `<div class="modal-body shop-layout">${curatorMarkup()}<div class="shop-grid">` + visibleItems.map(item => `<article class="shop-card ${ui.curatorRecommendation === item.id ? 'curator-recommended' : ''}" data-item="${item.id}">${ui.curatorRecommendation === item.id ? '<span class="recommend-tag">馆长推荐</span>' : ''}<div class="item-icon ${item.photo ? 'shop-photo' : 'shop-symbol'}">${item.photo ? photoMarkup(item.photo, item.name) : icon(item.icon)}</div><p class="eyebrow">${item.label}</p><h3>${item.name}</h3><p class="item-origin">${item.note}</p><p class="item-effect">${childEffects[item.id]}<small>${item.effect}</small></p><button class="ask-curator" data-act="curator-item" data-id="${item.id}" aria-label="向馆长询问${item.name}">问问馆长 <span>→</span></button><button class="${game.upgrades[item.id] ? 'secondary' : 'primary'}" data-act="buy" data-id="${item.id}" ${game.upgrades[item.id] || game.state !== 'map' ? 'disabled' : ''}>${game.upgrades[item.id] ? '已拥有' : `购买 <span class="price">${item.price} <small>海贝</small></span>`}</button></article>`).join('') + '</div></div>' + overlayFooter('<span id="shop-page-label">' + (ui.shopPage + 1) + ' / ' + (game.mode === 'endless' ? 3 : 2) + '</span> · ' + (game.mode === 'endless' ? '第3页可备草料与护符' : '道具效果为游戏创作'), `<button data-act="shop-page" data-step="-1" ${ui.shopPage === 0 ? 'disabled' : ''} aria-label="商店上一页">← 上一页</button> <button data-act="shop-page" data-step="1" ${ui.shopPage === (game.mode === 'endless' ? 2 : 1) ? 'disabled' : ''} aria-label="商店下一页">下一页 →</button><small>方向键选择 · 空格 / A 确认 · LB / RB 翻页 · B 返回</small>`) + purchaseMarkup();
    } else if (ui.overlay === 'museum') {
      const groups = ['全部展品', ...new Set(Museum.entries.map(entry => entry.group))];
      const entries = Museum.entries.filter(entry => ui.filter === '全部展品' || entry.group === ui.filter);
      const pages = Math.max(1, Math.ceil(entries.length / 6));
      ui.page = Math.min(ui.page, pages - 1);
      const visible = entries.slice(ui.page * 6, ui.page * 6 + 6);
      if (!entries.some(entry => entry.id === ui.exhibit)) ui.exhibit = entries[0].id;
      const exhibit = Museum.entries.find(entry => entry.id === ui.exhibit);
      const unlocked = game.unlocked.includes(exhibit.id);
      modal.innerHTML = overlayHeader('循物读史 · 本局收录', '博物馆图鉴', `<span class="modal-label">已收录 ${game.unlocked.length} / ${Museum.entries.length}</span>`) +
        `<div class="modal-body museum-layout"><aside class="cabinet-nav">${groups.map(group => `<button class="${ui.filter === group ? 'active' : ''}" data-act="filter" data-id="${escape(group)}">${group}</button>`).join('')}<p class="small muted">展柜为游戏内容分组<br>并非真实展厅复原</p></aside><div class="museum-grid">${visible.map(entry => `<button class="exhibit ${ui.exhibit === entry.id ? 'active' : ''} ${game.unlocked.includes(entry.id) ? '' : 'locked'}" data-act="exhibit" data-id="${entry.id}" aria-label="${escape(entry.name)}${game.unlocked.includes(entry.id) ? '，已收录' : '，待解锁'}"><span class="item-icon">${photoKeys[entry.id] ? photoMarkup(photoKeys[entry.id], entry.name) : icon(entry.icon)}</span><span class="exhibit-name">${escape(entry.name)}</span><span class="exhibit-era">${game.unlocked.includes(entry.id) ? '已收录 · 查看' : '未收录 · 查看线索'}</span></button>`).join('')}</div><article class="museum-detail"><p class="eyebrow">${escape(exhibit.group)}</p><h3>${escape(exhibit.name)}</h3>${unlocked ? `${photoKeys[exhibit.id] ? `<div class="detail-photo">${photoMarkup(photoKeys[exhibit.id], exhibit.name)}</div>${photoCreditMarkup(photoKeys[exhibit.id])}` : ''}<p class="detail-meta">${escape(exhibit.era)}<br>${escape(exhibit.origin)}<br>${escape(exhibit.museum)}</p><span class="source-badge">${escape(exhibit.sourceType)}</span><p class="facts">${escape(exhibit.facts)}</p><p class="game-note"><b>在游戏中</b>${escape(exhibit.gameNote)}</p>${exhibit.id === 'container' ? '<button class="secondary wide" style="margin-top:15px" data-act="official">阅读完整馆方原文 →</button>' : ''}${observationMarkup(exhibit)}` : `<div class="locked-note">尚未收录<br><span style="color:var(--gold)">${escape(exhibit.unlockHint)}</span></div><p class="game-note">继续驯马、购买道具或经历双虎试炼，逐步点亮展柜。</p>`}</article></div>` +
        overlayFooter('LT / RT 滚动详情 · 馆方摘要 / 研究摘编', `<button data-act="page" data-step="-1" ${ui.page === 0 ? 'disabled' : ''} aria-label="上一页">←</button>　${ui.page + 1} / ${pages}　<button data-act="page" data-step="1" ${ui.page === pages - 1 ? 'disabled' : ''} aria-label="下一页">→</button>　 LB / RB 翻页 · B 返回`);
    } else if (ui.overlay === 'official') {
      modal.innerHTML = overlayHeader('馆方原文 · 完整保留', '驯马场面铜贮贝器') + `<article class="modal-body" style="padding:29px 36px"><p class="detail-meta muted">西汉（公元前202－公元8年） · 云南江川李家山墓地出土<br>云南李家山青铜器博物馆藏</p><p class="official-text" style="margin-top:23px">${escape(Museum.officialText)}</p><p class="archive-source">《吉金万里 重点文物说明（20260929）》<br>“似为”等推测语气予以保留；游戏机制属于艺术创作。</p></article>` + overlayFooter('馆方原文完整保留 · LT / RT 上下滚动');
    } else if (ui.overlay === 'leaderboard') {
      const board = Core.save.getLeaderboard();
      const rank = Core.save.getLeaderboardRank(game.leaderboardId);
      const top = board.slice(0, 8);
      const inTop = top.some(entry => entry.id === game.leaderboardId);
      const current = board.find(entry => entry.id === game.leaderboardId);
      modal.innerHTML = overlayHeader('本机排行榜 · 只保存在这台设备', '七马通关总分榜', `<span class="modal-label">${rank ? `本次第 ${rank.rank} 名` : '本次未上榜'} · 共 ${board.length} 条</span>`) +
        `<div class="modal-body leaderboard-body"><p class="board-lead">按总分排序，同分看星级。离线保存，不会上传。</p><ol class="board-list">` +
        top.map((entry, index) => `<li class="board-row${entry.id === game.leaderboardId ? ' current' : ''}"${entry.id === game.leaderboardId ? ' aria-current="true"' : ''}><span class="board-rank">${index + 1}</span><span class="board-name">${escape(entry.name)}${entry.id === game.leaderboardId ? '<small>本次</small>' : ''}</span><span class="board-score">${entry.score}</span><span class="board-stars" aria-label="${entry.stars}颗星">${'★'.repeat(entry.stars)}${'☆'.repeat(Math.max(0, 5 - entry.stars))}</span><span class="board-diff">${escape(Core.DIFFICULTIES[entry.difficulty]?.name || entry.difficulty)}</span><span class="board-date">${escape(entry.date)}</span></li>`).join('') +
        (board.length ? '' : '<li class="board-row board-empty">还没有成绩。完成七组归位，就会留下第一条记录。</li>') +
        `</ol>${!inTop && current ? `<p class="board-outside">本次第 ${rank.rank} 名 · ${current.score} 分，未进前八。</p>` : ''}<div class="board-editor"><label for="board-name">本次昵称</label><input id="board-name" type="text" maxlength="8" value="${escape(Core.save.getNickname())}" autocomplete="off" spellcheck="false"><button class="primary" data-act="rename-leaderboard">保存昵称</button></div><p class="board-note">昵称最多 8 个字，只保存在这台设备。清空存档时榜单会一并清空；无尽挑战的轮数纪录单独保存。</p></div>` +
        overlayFooter('本机排行榜为游戏创作，不联网、不上传昵称。', 'Tab 输入昵称 · Enter 保存 · Esc 返回档案');
    } else if (ui.overlay === 'controls') {
      modal.classList.add('controls-modal');
      modal.innerHTML = overlayHeader('操作指南 · 收放与攻守', '一键牵缰，双手读史') + `<table class="controls-table"><thead><tr><th>操作</th><th>键盘</th><th>标准手柄</th></tr></thead><tbody><tr><td>菜单确认 / 开始 / 购买</td><td>空格 / Enter</td><td>A</td></tr><tr><td>指针上升 / 下降</td><td>按住 / 松开空格</td><td>按住 / 松开 A</td></tr><tr><td>选择难度 / 人马 / 图鉴导航</td><td>方向键</td><td>十字键</td></tr><tr><td>差事三选一 / 稍后</td><td>方向键选择 · 空格 / Enter确认 · Shift稍后</td><td>十字键选择 · A确认 · B稍后</td></tr><tr><td>双虎战攻击（有间隔）</td><td>空格 / Enter</td><td>A</td></tr><tr><td>双虎闪避 / 关闭展柜</td><td>Shift</td><td>B</td></tr><tr><td>暂停 / 继续 / 音效开关</td><td>Esc后选择</td><td>START后选择</td></tr><tr><td>商店 / 图鉴翻页</td><td>[ / ]</td><td>LB / RB</td></tr><tr><td>图鉴详情 / 原文滚动</td><td>PageUp / PageDown</td><td>LT / RT</td></tr><tr><td>商店 / 图鉴入口</td><td>S / M</td><td>十字键选菜单或地图中心</td></tr></tbody></table><p class="controls-note">默认新手，首次先练习按住、松开和保持；Enter / B 可跳过。新手战败不扣海贝。第4匹归位后固定进入双虎章节战，胜负均可继续；驯马超时也会立刻引来双虎，战后回到该组重试。超时保留最高进度的一半（上限50%），不扣海贝。攻击削减双虎血量；收缩圈进入绿环时闪避可反击。<br>鼠标可点击、长按收缰；连接标准手柄后按任意键识别。失焦与断连自动暂停，阅读图鉴时计时停止。</p>` + overlayFooter('返回后会先等待松开按键，避免误触');
    } else if (ui.overlay === 'pause' && game.state === 'title') {
      modal.classList.add('pause-modal', 'title-settings');
      modal.innerHTML = overlayHeader('操作 · 声音 · 存档', '设置') +
        `<div class="pause-list"><p class="group-title"><span>操作</span><small>OPTIONS</small></p><button class="primary" data-act="resume">返回主界面 <span>→</span></button><button data-act="controls">按键说明 <span>↗</span></button></div>${volumeMarkup()}<div class="save-settings"><p class="group-title"><span>存档管理</span><small>SAVE</small></p><p class="save-desc">家业跨局保留。清空后需要重新积累。</p><button id="wipe-save" data-act="wipe-save">${ui.wipeUntil ? '再按一次，确认清空' : '清空家业与设置'}</button><p id="wipe-status" role="status" aria-live="polite">${ui.wipeUntil ? '请在三秒内再次确认，退出设置即取消。' : '清空需要再次确认。'}</p></div>` + overlayFooter('商店、差事与双虎试炼为游戏创作', 'Esc / START 返回');
    } else {
      modal.classList.add('pause-modal');
      modal.innerHTML = overlayHeader('时间停驻 · 稍作休整', '已暂停') + `<div class="pause-list"><p class="group-title"><span>菜单</span><small>MENU</small></p><button class="primary" data-act="resume">继续驯马 <span>→</span></button><button data-act="controls">按键说明 <span>↗</span></button><button data-act="museum">博物馆图鉴 <span>↗</span></button>${game.mode === 'endless' ? '<button data-act="endless-finish">收官并保存纪录 <span>→</span></button>' : '<button data-act="title">返回标题 <span>←</span></button>'}</div>${volumeMarkup()}` + overlayFooter('本局不会在后台继续计时', 'Esc / START 继续');
    }
    if (ui.overlay === 'shop' && ui.pendingPurchase) {
      for (const child of modal.querySelectorAll(':scope > :not(.purchase-shade)')) child.inert = true;
    }
    updateCuratorPose(performance.now());
    requestAnimationFrame(focusFirst);
  }
  function perform(action, button) {
    Sound.unlock();
    if (!['attack', 'dodge'].includes(action)) Sound.play('ui');
    if (action === 'endless') {
      if (Core.setMode(game, 'endless')) { openOverlay('difficulty'); updateViews(); }
      return;
    }
    if (action === 'difficulty' && game.state === 'title') Core.setMode(game, 'story');
    if (action === 'endless-next' || action === 'endless-retry') {
      const ok = action === 'endless-next' ? Core.continueEndless(game) : Core.retryEndlessBoss(game);
      if (!ok) return;
      clearReward(); Effects.clear(); clearOverlays(); resetCurator(); ui.curatorLastCompleted = 0;
      ui.selection = game.selectedHorse; ui.praiseRemaining = 0; ui.lastState = null;
      updateViews();
      if (action === 'endless-retry') { ui.pendingChallenge = {type:'tiger'}; ui.lastState = 'tiger'; openOverlay('ready'); }
      return;
    }
    if (action === 'endless-finish') {
      if (!Core.endEndless(game)) return;
      ui.pendingChallenge = null; clearReward(); Effects.clear(); clearOverlays();
      ui.lastState = game.state; updateViews(); openOverlay('endless'); return;
    }
    if (action === 'supply') {
      if (ui.overlay !== 'shop') return;
      const result = Core.buySupply(game, button?.dataset.id);
      toast(result.reason); updateHud(); renderModal(); return;
    }
    if (action === 'prelude') { if (globalThis.GameIntro) globalThis.GameIntro.start(0); return; }
    if (action === 'errand') { openErrands(); return; }
    if (action === 'errand-select') {
      if (ui.overlay !== 'errand') return;
      const result = Core.resolveErrand(game, button?.dataset.id);
      if (!result.ok) return;
      ui.errandDone++; toast(result.text); flushInputs(); updateViews();
      if (game.pendingErrands > 0) renderModal();
      else {
        const origin = ui.errandOrigin; closeOverlay();
        if (game.victoryPending) { Core.enterVictory(game); flushInputs(); updateViews(); }
        else if (origin === 'shop') openOverlay('shop');
      }
      return;
    }
    if (action === 'wipe-save') {
      if (game.state !== 'title' || ui.overlay !== 'pause') return;
      const now = performance.now();
      if (ui.wipeUntil && now < ui.wipeUntil) {
        Core.save.clearSave(); ui.wipeUntil = 0;
        const settings = Core.save.getSettings();
        if (Sound.enabled !== settings.sound) toggleSound();
        if (typeof Sound.setMusicVolume === 'function') Sound.setMusicVolume(settings.musicVolume);
        if (typeof Sound.setSfxVolume === 'function') Sound.setSfxVolume(settings.sfxVolume);
        if (typeof Voice.setVolume === 'function') Voice.setVolume(settings.sfxVolume);
        game.difficulty = settings.difficulty;
        toast('家业已清空，从头开始'); updateViews(); renderModal();
      } else ui.wipeUntil = now + 3000;
      const wipeButton = $('wipe-save'), wipeStatus = $('wipe-status');
      if (wipeButton) wipeButton.textContent = ui.wipeUntil ? '再按一次，确认清空' : '清空家业与设置';
      if (wipeStatus) wipeStatus.textContent = ui.wipeUntil ? '请在三秒内再次确认，退出设置即取消。' : '家业与设置已清空。';
      return;
    }
    if (action.startsWith('curator-')) {
      if (ui.overlay !== 'shop' || ui.pendingPurchase) return;
      if (action === 'curator-voice-toggle') { if (!Sound.enabled) toggleSound(); Voice.playing ? Voice.pause() : Voice.resume(); return; }
      if (action === 'curator-voice-replay') { if (!Sound.enabled) toggleSound(); Voice.replay(); return; }
      if (action === 'curator-voice-mute') { toggleSound(); updateCuratorPose(performance.now()); return; }
      if (action === 'curator-topic') {
        if (!['help', 'story', 'choose'].includes(button.dataset.id)) return;
        ui.curatorTopic = button.dataset.id; ui.curatorStep = 0;
        ui.curatorSource = '';
        ui.curatorRecommendation = ui.curatorTopic === 'choose' ? recommendItem() : null;
        ui.curatorThinkingUntil = ui.curatorTopic === 'choose' ? performance.now() + 650 : 0;
      } else if (action === 'curator-home') resetCurator();
      else if (action === 'curator-quiz') { resetCurator(); ui.curatorTopic = 'quiz'; }
      else if (action === 'curator-answer' && ui.curatorTopic === 'quiz') {
        const quiz = Dialogue.quizzes[ui.curatorStep], answer = Number(button?.dataset.id);
        if (!quiz || !Number.isInteger(answer) || answer < 0 || answer >= quiz.choices.length || ui.curatorQuizAnswers[ui.curatorStep] !== undefined) return;
        ui.curatorQuizAnswers[ui.curatorStep] = answer;
      } else if (action === 'curator-quiz-next' && ui.curatorTopic === 'quiz') {
        if (ui.curatorQuizAnswers[ui.curatorStep] === undefined) return;
        ui.curatorStep = Math.min(ui.curatorStep + 1, Dialogue.quizzes.length);
      } else if (action === 'curator-chat') { resetCurator(); ui.curatorTopic = 'chat'; ui.curatorMood = 'encouraging'; }
      else if (action === 'curator-item') {
        if (!items.some(item => item.id === button?.dataset.id)) return;
        resetCurator(); ui.curatorTopic = 'item'; ui.curatorItem = button.dataset.id;
      } else if (action === 'curator-item-mode' && ui.curatorTopic === 'item') ui.curatorItemMode = ui.curatorItemMode === 'history' ? 'effect' : 'history';
      else if (action === 'curator-item-exhibit' && ui.curatorTopic === 'item') {
        ui.filter = '全部展品'; ui.page = 0; ui.exhibit = ui.curatorItem === 'rope' ? 'container' : ui.curatorItem;
        openOverlay('museum'); return;
      }
      else if (action === 'curator-next' && ['help', 'story'].includes(ui.curatorTopic)) ui.curatorStep = Math.min(ui.curatorStep + 1, (ui.curatorTopic === 'help' ? curatorLessons : curatorStories).length - 1);
      else if (action === 'curator-exhibit' && ['story', 'quiz'].includes(ui.curatorTopic)) {
        ui.filter = '全部展品'; ui.page = 0; ui.exhibit = ui.curatorTopic === 'quiz' ? Dialogue.quizzes[ui.curatorStep]?.exhibit || 'container' : curatorStories[ui.curatorStep].exhibit;
        openOverlay('museum'); return;
      } else if (action === 'curator-recommend' && ui.curatorRecommendation) { ui.curatorThinkingUntil = 0; ui.shopPage = Math.floor(items.findIndex(item => item.id === ui.curatorRecommendation) / 3); }
      flushInputs(); renderModal();
      if (action === 'curator-recommend') requestAnimationFrame(() => {
        const target = $('modal').querySelector(`[data-act="buy"][data-id="${ui.curatorRecommendation}"]:not(:disabled)`);
        if (target) target.focus({ preventScroll: true });
      });
      return;
    }
    if (action === 'leaderboard') {
      if (game.state !== 'archive') return;
      openOverlay('leaderboard');
      return;
    }
    if (action === 'rename-leaderboard') {
      if (ui.overlay !== 'leaderboard' || !game.leaderboardId) return;
      const input = $('modal').querySelector('#board-name');
      const result = Core.save.renameLeaderboardEntry(game.leaderboardId, input ? input.value : '');
      toast(result.ok ? `昵称已保存：${result.name}` : result.reason);
      if (result.ok) { updateViews(); renderModal(); }
      return;
    }
    if (action === 'new' || action === 'endless-new') {
      ui.errandAuto = false; ui.errandOrigin = null; resetWipeConfirmation();
      ui.praiseRemaining = 0; ui.dodgeRound = 0; ui.dodgeBattle = null;
      resetCurator(); ui.curatorLastCompleted = 0;
      ui.pendingChallenge = null;
      clearReward();
      Effects.clear(); feedback('start', 435, 360);
      clearOverlays(); Core.startRun(game, game.difficulty, action === 'endless-new' ? 'endless' : game.mode); ui.selection = 0; ui.lastUnlocks = 2; ui.lastNotice = ''; ui.filter = '全部展品'; ui.exhibit = 'container'; updateViews();
    } else if (action === 'title') {
      if (game.mode === 'endless') Core.endEndless(game);
      ui.errandAuto = false; ui.errandOrigin = null; resetWipeConfirmation();
      ui.praiseRemaining = 0; ui.dodgeRound = 0; ui.dodgeBattle = null;
      resetCurator(); ui.curatorLastCompleted = 0;
      ui.pendingChallenge = null;
      clearReward();
      clearOverlays(); Object.assign(game, Core.createGame()); ui.selection = 0; ui.lastUnlocks = 2; ui.lastNotice = ''; updateViews(); focusFirst();
    } else if (action === 'start') {
      clearReward();
      if (game.state === 'map' && !ui.overlay && !game.completed[game.selectedHorse]) {
        selectBronze(game.selectedHorse);
        ui.selection = game.selectedHorse; updateViews();
        ui.pendingChallenge = {type:'horse',index:ui.selection}; Effects.clear(); openOverlay('ready');
      }
    } else if (action === 'ready-start') {
      if (ui.overlay !== 'ready' || !ui.pendingChallenge) return;
      const challenge = ui.pendingChallenge; ui.pendingChallenge = null;
      clearReward(); Effects.clear(); clearOverlays();
      if (challenge.type === 'horse') { Core.startHorse(game, challenge.index); ui.praiseRemaining = 0; }
      feedback('start',425,365); flushInputs(); ui.lastState=game.state; updateViews();
    } else if (action === 'tutorial-skip') {
      if (Core.skipTutorial(game)) { flushInputs(); updateViews(); liveReadouts(); }
    } else if (action === 'horse') {
      if (game.state === 'map' && !ui.overlay) { ui.selection = Number(button.dataset.index); game.selectedHorse = ui.selection; selectBronze(ui.selection); updateViews(); }
    } else if (action === 'lesson') {
      ui.filter = '全部展品'; ui.page = 0;
      const index = game.activeHorse === null ? ui.selection : game.activeHorse;
      ui.exhibit = index > 0 && index < 4 && game.unlocked.includes('bell') ? 'bell' : 'container';
      openOverlay('museum');
    } else if (action === 'difficulty-select') {
      Core.setDifficulty(game, button.dataset.id); renderModal(); updateHud();
    } else if (action === 'difficulty' || action === 'shop' || action === 'museum' || action === 'pause' || action === 'controls' || action === 'official') {
      if (action === 'shop' && !['map', 'title'].includes(game.state)) { toast('先完成本次挑战，再前往商店。'); return; }
      if (action === 'shop' && game.state === 'map') { ui.selection = 7; selectBronze(7); updateViews(); }
      if (action === 'shop' && game.state === 'map' && game.pendingErrands > 0) { openErrands('shop'); return; }
      openOverlay(action);
    } else if (action === 'close') { if (ui.overlay === 'shop') resetCurator(); closeOverlay(); }
    else if (action === 'resume') {
      if (ui.overlay === 'pause' && ['errand', 'endless'].includes(ui.stack[ui.stack.length - 1])) closeOverlay();
      else if (ui.pendingChallenge) { ui.overlay = 'ready'; ui.stack = [null]; game.paused = true; flushInputs(); renderModal(); }
      else clearOverlays();
      updateViews();
    }
    else if (action === 'buy') {
      if (ui.overlay !== 'shop') return;
      const item = items.find(item => item.id === button.dataset.id);
      if (!item || game.state !== 'map' || game.upgrades[item.id]) return;
      if (game.cowries < item.price) {
        resetCurator(); ui.curatorMessage = Dialogue.lines.insufficient;
        ui.curatorSource = `这件需要${item.price}枚海贝，你还差${item.price - game.cowries}枚。`;
        ui.curatorMood = 'encouraging';
        renderModal(); return;
      }
      ui.pendingPurchase = item.id; flushInputs(); renderModal();
    } else if (action === 'purchase-cancel') {
      ui.pendingPurchase = null; flushInputs(); renderModal();
    } else if (action === 'purchase-confirm') {
      if (ui.overlay !== 'shop' || !ui.pendingPurchase) return;
      const id = ui.pendingPurchase;
      ui.pendingPurchase = null;
      const result = Core.buy(game, id);
      resetCurator();
      if (result.ok) {
        const item = items.find(item => item.id === id);
        const exhibit = Museum.entries.find(entry => entry.id === (id === 'rope' ? 'container' : id));
        ui.curatorMessage = exhibit.purchaseIntro;
        ui.curatorSource = '馆长讲古物 · ' + exhibit.sourceType;
        ui.curatorMood = 'explaining';
        celebrate({ kind: 'purchase', title: `${item.name}，到手啦！`, detail: childEffects[id] });
      }
      flushInputs(); toast(result.reason); renderModal(); updateHud();
    } else if (action === 'filter') {
      ui.filter = button.dataset.id; ui.page = 0; renderModal();
    } else if (action === 'exhibit') {
      ui.exhibit = button.dataset.id; renderModal();
      requestAnimationFrame(() => { const current = $('modal').querySelector(`[data-act="exhibit"][data-id="${ui.exhibit}"]`); if (current) current.focus(); });
    } else if (action === 'page') {
      ui.page += Number(button.dataset.step); ui.exhibit = ''; renderModal();
    } else if (action === 'shop-page') {
      ui.pendingPurchase = null;
      ui.shopPage = Math.max(0, Math.min(game.mode === 'endless' ? 2 : 1, ui.shopPage + Number(button.dataset.step)));
      if (ui.shopPage === 2) { resetCurator(); Voice.pause(); }
      renderModal();
    } else if (action === 'attack') {
      attackTiger(); liveReadouts();
    } else if (action === 'dodge') {
      dodgeTiger(); updateViews();
    } else if (action === 'music') {
      Sound.toggleMusic();
      $('music-label').textContent = Sound.musicEnabled ? '音乐 开' : '音乐 关';
      $('music-toggle').setAttribute('aria-pressed', String(Sound.musicEnabled));
      $('music-toggle').setAttribute('aria-label', '背景音乐，' + (Sound.musicEnabled ? '已开启' : '已关闭'));
      if (ui.overlay) renderModal();
    } else if (action === 'sound') {
      toggleSound(); renderModal();
    }
  }
  function updateHud() {
    $('count').textContent = game.completed.filter(Boolean).length;
    $('cowries').textContent = game.cowries;
    $('difficulty-label').textContent = profile().name;
    $('difficulty-label').dataset.difficulty = game.difficulty;
    shown('endless-hud', game.mode === 'endless' && game.state !== 'title');
    const endlessBest = Core.save.getEndlessBest()[game.difficulty];
    const endlessText = `无尽 · 第${game.endlessRound}轮　已完成 ${game.endlessRounds}轮　勇气 ${game.courage} / 3　纪录 ${endlessBest.rounds}轮 + ${endlessBest.horses}匹${game.endlessShield ? '　护符已备' : ''}`;
    if ($('endless-hud').textContent !== endlessText) $('endless-hud').textContent = endlessText;
    $('reward-label').textContent = reward();
    $('collection-count').textContent = `${game.unlocked.length}/${Museum.entries.length}`;
    $('score').textContent = Core.scoreBreakdown(game).total;
    $('upgrade-icons').textContent = [game.upgrades.rope && '缰', game.upgrades.bell && '铃', game.upgrades.gold && '鞘', game.upgrades.sword && '剑', game.upgrades.fish && '杖', game.upgrades.token && '金'].filter(Boolean).join(' · ');
    $('errand-badge').textContent = game.state === 'map' && game.pendingErrands ? String(game.pendingErrands) : '';
    $('errand-badge').classList.toggle('hidden', game.state !== 'map' || !game.pendingErrands);
  }
  function updateViews() {
    const state = game.state;
    $('stage').dataset.screen = state;
    shown('title-screen', state === 'title'); shown('run-hud', state !== 'title');
    shown('map-panel', state === 'map'); shown('taming-panel', state === 'taming'); shown('taming-focus', state === 'taming');
    shown('tiger-panel', state === 'tiger'); shown('victory-screen', state === 'victory'); shown('archive-screen', state === 'archive');
    shown('shop-nav', state === 'map'); shown('museum-nav', state !== 'title');
    shown('title-provenance', state === 'title');
    $('pause-label').textContent = state === 'title' ? '设置' : '暂停';
    $('pause-toggle').setAttribute('aria-label', state === 'title' ? '设置与按键说明' : '暂停与按键说明');
    updateHud();
    if (state === 'title') {
      const best = Core.save.getBest()[game.difficulty] || 0;
      $('best-score').textContent = best ? `最佳评分 ${best} · ${profile().name}` : '最佳评分 · 等你创造';
      const endlessBest = Core.save.getEndlessBest()[game.difficulty];
      $('best-endless').textContent = `无尽纪录 · ${profile().name} ${endlessBest.rounds}轮 + ${endlessBest.horses}匹`;
    }
    if (state === 'victory' || state === 'archive') {
      const breakdown = Core.scoreBreakdown(game);
      const total = game.finalScore || breakdown.total;
      const stars = game.finalStars || Core.runStars(game);
      const starText = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
      if (state === 'victory') {
        $('victory-score').textContent = `评分 ${total} · ${starText}`;
      } else {
        const average = Core.averageHorseScore(game);
        const best = game.bestScore || Core.save.getBest()[game.difficulty] || total;
        $('archive-score').innerHTML = `<strong>${total}</strong><span class="score-unit">分</span><span class="score-stars" aria-label="获得${stars}颗星">${starText}</span><span class="score-parts">驯马 ${breakdown.taming} · 双虎 ${breakdown.combat} · 典藏 ${breakdown.explore} · 七马均分 ${average}（${Core.gradeFor(average).id}）</span><span class="score-best${game.newBest ? ' is-new' : ''}">${game.newBest ? `最佳 ${best} · 刷新纪录！` : `最佳 ${best}`}</span>`;
        const rank = Core.save.getLeaderboardRank(game.leaderboardId);
        $('archive-rank').textContent = rank ? `本次第 ${rank.rank} 名` : '本次未上榜';
      }
    }
    if (state === 'map') {
      const index = game.selectedHorse;
      const center = ui.selection === 7;
      $('map-shop-label').textContent = game.pendingErrands ? '头领的差事 ×' + game.pendingErrands : '前往中心商店';
      const industry = Core.save.getIndustry();
      $('industry-badges').innerHTML = center ? Core.ERRANDS.filter(item => industry[item.id] > 0).map(item => `<span>${item.industry} Lv${industry[item.id]}</span>`).join('') : '';
      $('horse-index').textContent = center ? '中' : String(index + 1).padStart(2, '0');
      $('horse-title').textContent = center ? '器盖中央 · 贝市' : names[index];
      $('horse-desc').textContent = center ? '用海贝换道具，帮马儿归位。' : game.completed[index] ? '这组马儿归位啦！再选一组吧。' : index === 0 ? '按住向上，松开向下。' : '跟着马儿的提示，收放缰绳。';
      $('chapter-hint').textContent = game.mode === 'endless' ? `第${game.endlessRound}轮：七马归位后挑战四道攻击守关。虎战战败扣勇气，可用商店补给备战。` : game.completed.filter(Boolean).length === 6 ? '再归位一匹，将迎来四道攻击的高难度双虎终战。' : game.tigerChapterUsed ? '章节试炼已过；七马归位后还有高难度终战。超时仍会引来双虎。' : game.completed.filter(Boolean).length === 3 ? '下一匹归位后双虎将苏醒；七马归位后还有高难度终战。' : '归位4匹进入双虎试炼，七马归位进入高难度终战；超时也会引来双虎。';
      $('horse-difficulty').textContent = center ? '文物意象 · 一次性购入' : game.completed[index] ? '✓ 已归位' : `${profile().name} · ${game.retryProgress[index] ? `${Math.round(game.retryProgress[index] * 100)}% 保留进度` : index === 0 ? '初试' : index < 4 ? '进阶' : '烈马'}`;
      $('horse-select').innerHTML = game.completed.map((done, i) => `<button class="${i === index ? 'selected' : ''} ${done ? 'done' : ''}" data-act="horse" data-index="${i}" aria-pressed="${i === index}" aria-label="第${i + 1}组${done ? '已归位' : '未归位'}">${done ? '✓' : String(i + 1).padStart(2, '0')}</button>`).join('');
      $('start-horse-label').textContent = game.completed[index] ? '已归位 · 请选下一组' : '进入训练';
      $('start-horse-key').textContent = center ? '↑' : '空格 / A';
      $('start-horse').disabled = game.completed[index];
      $('map-shop-key').textContent = center ? '空格 / A' : '↓';
      for (const [id, selected] of [['start-horse', !center], ['map-shop', center]]) {
        $(id).classList.toggle('selected', selected);
        $(id).classList.toggle('primary', selected);
        $(id).classList.toggle('secondary', !selected);
        $(id).setAttribute('aria-current', selected ? 'location' : 'false');
      }
      $('map-selection-status').textContent = center ? '当前选择：中心商店 · ↑ 返回训练' : `当前选择：第 ${String(index + 1).padStart(2, '0')} 组训练`;
    }
    if (state === 'taming') {
      $('taming-title').textContent = names[game.activeHorse];
      $('focus-location').textContent = `器盖周沿 · 第 ${String(game.activeHorse + 1).padStart(2, '0')} 组牵马`;
      $('focus-observation').textContent = game.activeHorse === 0 ? '看提示，按住或松开，让马儿跟着你走。' : game.activeHorse < 4 ? '跟着马儿收放，铜铃能让节奏慢一点。' : '马儿变化更快啦，看准提示再收放。';
    }
    $('bottom-hint').innerHTML = state === 'title' ? '<span><kbd>↑ ↓</kbd> 选择</span><span><kbd>空格 / A</kbd> 确认</span><span><kbd>Esc / START</kbd> 设置</span>' : state === 'taming' ? '<kbd>按住空格 / A</kbd> 收缰 <kbd>松开</kbd> 松缰 <kbd>M</kbd> 观察图鉴 <kbd>Esc / START</kbd> 暂停' : state === 'tiger' ? '<kbd>空格 / A</kbd> 攻击 <kbd>Shift / B</kbd> 闪避反击 <kbd>Esc / START</kbd> 暂停' : '<kbd>空格 / A</kbd> 确认 <kbd>方向键</kbd> 选择 <kbd>M</kbd> 图鉴 <kbd>Esc / START</kbd> 暂停';
  }
  function liveReadouts() {
    const learning = game.state === 'taming' && game.taming.tutorial;
    shown('practice-guide', !!learning);
    shown('practice-stars', game.state === 'taming' && !learning);
    shown('practice-praise', game.state === 'taming' && !learning && ui.praiseRemaining > 0 && !ui.overlay);
    shown('dodge-cue', game.state === 'tiger'); shown('tiger-attack-queue', game.state === 'tiger');
    if (game.state === 'taming') {
      const t = game.taming;
      $('taming-panel').dataset.learning = String(!!learning);
      const lessons = {
        hold: ['1 / 3 · 先试试按住', '按住按钮 ↑', '按住按钮，让指针上升。'],
        release: ['2 / 3 · 再试试松开', '松开手 ↓', '松开按钮，让指针下降。'],
        steady: ['3 / 3 · 跟着提示收放', '留在绿色里', '跟着提示，留在绿色里。']
      };
      if (learning) {
        const lesson = lessons[learning.step];
        $('practice-step').textContent = lesson[0]; $('practice-title').textContent = lesson[1]; $('practice-instruction').textContent = lesson[2];
      }
      const cue = Core.getTamingCue(game, holdingReins());
      const zone = cue.zone;
      $('zone').style.bottom = `${zone.min * 100}%`; $('zone').style.height = `${zone.width * 100}%`; $('pointer').style.bottom = `${t.position * 100}%`;
      if (learning) {
        $('practice-zone').style.bottom = `${zone.min * 100}%`; $('practice-zone').style.height = `${zone.width * 100}%`;
        $('practice-pointer').style.bottom = `${t.position * 100}%`;
      }
      const progress = Math.round(t.progress * 100);
      $('progress-number').innerHTML = `${progress}<small>%</small>`;
      $('progress-fill').style.width = `${progress}%`;
      $('progress-fill').parentElement.setAttribute('aria-valuenow', progress);
      $('timer').textContent = learning ? '练习' : `${Math.max(0, t.duration - t.elapsed).toFixed(1)}s`;
      $('taming-feedback').textContent = cue.inside ? '保持住，真棒！' : '跟着提示再试试';
      $('taming-feedback').style.color = cue.inside ? 'var(--green)' : 'var(--gold)';
      $('hold-button').classList.toggle('holding', cue.holding);
      $('taming-focus').dataset.posture = cue.posture;
      $('taming-focus').dataset.warning = String(cue.warning);
      $('scene-cue').textContent = learning ? lessons[learning.step][1] : t.phase === 'success' ? '马儿归位啦！' : cue.action === 'hold' ? '按住！收缰 ↑' : '松缰！放开手 ↓';
      $('scene-cue').dataset.action = cue.action;
      $('scene-feedback').textContent = learning ? '练习不计时，慢慢试就好。' : cue.warning ? '快到边上了，换个动作！' : cue.inside ? '做得好，马儿跟着你走！' : '没关系，跟着提示再试一下！';
      $('scene-progress').textContent = learning ? '练习中' : `${progress}%`;
      $('tutorial').textContent = learning ? '按住空格 / A 或大按钮 · 松开就下降' : `${profile().name} · 按住上升，松开下降${game.upgrades.bell ? ' · 铜铃已减慢漂移' : ''}`;
      const earned = game.progressMilestones[game.activeHorse];
      if ($('practice-stars').dataset.earned !== String(earned)) {
        $('practice-stars').dataset.earned = String(earned);
        $('practice-stars').setAttribute('aria-label', `已获得${earned}颗过程星章，共3颗`);
        $('practice-stars').innerHTML = Array.from({length:3}, (_, i) => `<span class="${i < earned ? 'earned' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 6.3 7 .9-5.1 4.9 1.3 6.9-6.2-3.4-6.2 3.4 1.3-6.9L2 9.2l7-.9z"/></svg></span>`).join('');
      }
    }
    if (game.state === 'tiger') {
      const t = game.tiger;
      $('tiger-panel').dataset.phase = t.phase;
      $('tiger-panel').dataset.radius = t.radius.toFixed(3);
      $('tiger-panel').classList.toggle('player-hit', t.playerHitFlash > 0);
      const dodgeCue = Core.getDodgeCue(game), dodgeReady = dodgeCue.ready;
      const active = t.fighters[t.activeTiger], partner = t.fighters[1 - t.activeTiger];
      $('tiger-panel').dataset.side = active.side;
      $('tiger-panel').dataset.attackCount = String(t.strikes.length);
      $('tiger-panel').dataset.pending = String(dodgeCue.pending);
      $('tiger-panel').dataset.trigger = t.trigger;
      $('tiger-panel').dataset.combatDifficulty = t.combatDifficulty;
      const queue = t.strikes.map(a => `<span data-order="${a.order}" data-state="${a.resolved ? a.outcome : a.id === t.round && t.phase === 'ring' ? 'next' : 'incoming'}"><b>${a.order}</b>${a.side === 'left' ? '左虎' : '右虎'}${a.resolved ? a.outcome === 'dodged' ? ' ✓' : a.outcome === 'hit' ? ' ×' : ' ·' : ''}</span>`).join('');
      if ($('tiger-attack-queue').innerHTML !== queue) $('tiger-attack-queue').innerHTML = queue;
      for (const fighter of t.fighters) {
        const isReady = dodgeReady && fighter === active;
        $(`tiger-${fighter.side}-state`).dataset.phase = fighter.phase;
        $(`tiger-${fighter.side}-state`).classList.toggle('ready', isReady);
        $(`tiger-${fighter.side}-action`).textContent = isReady ? '现在闪避！' : fighter.phase === 'strike' ? `${fighter.pending}道攻击逼近` : fighter.phase === 'windup' ? '准备同时进攻' : fighter.phase === 'recover' ? '扑击后休整' : fighter.phase === 'done' ? '试炼结束' : '等待接招';
      }
      $('dodge-cue').dataset.ready = String(dodgeReady);
      $('dodge-cue').dataset.side = active.side;
      $('dodge-cue').dataset.order = String(dodgeCue.order);
      const dodgeText = dodgeReady ? `现在！躲${active.name}第${dodgeCue.order}击` : t.phase === 'ring' ? `第${dodgeCue.order}击 · ${active.name}正在逼近` : t.phase === 'recover' ? dodgeCue.pending ? `松开闪避 · 还有${dodgeCue.pending}道攻击` : '本轮结束 · 抓紧挥击' : t.phase === 'intro' ? `${t.strikes.length}道攻击 · 按编号闪避` : '试炼结束，继续出发';
      if ($('dodge-cue').textContent !== dodgeText) $('dodge-cue').textContent = dodgeText;
      $('dodge-button').classList.toggle('dodge-ready', dodgeReady);
      $('tiger-title').textContent = t.phase === 'intro' ? t.trigger === 'finale' ? '七马，终战。' : '双虎苏醒' : t.phase === 'ring' ? `${t.strikes.length}道齐攻。` : t.phase === 'recover' ? dodgeCue.pending ? '攻势未停。' : '趁势，挥击。' : t.result === 'success' ? '双虎退却。' : '稍退，再来。';
      const tigerEyebrow = t.trigger === 'finale' ? `七马归位 · ${Core.DIFFICULTIES[t.combatDifficulty].name}强度终战` : t.trigger === 'chapter' ? '四马归位 · 双虎章节试炼' : '驯马超时 · 器耳双虎来袭';
      if ($('tiger-eyebrow').textContent !== tigerEyebrow) $('tiger-eyebrow').textContent = tigerEyebrow;
      const backLine = t.trigger === 'finale' ? '七马终战完成，即将开启文物档案。' : t.trigger === 'chapter' ? '继续驯服剩余马匹。' : '回到地图，重试刚才超时的那组。';
      $('tiger-message').textContent = game.mode === 'endless' ? (t.phase === 'intro' ? `第${game.endlessRound}轮 · ${t.trigger === 'finale' ? '四道攻击守关，获胜才能进入下一轮' : '超时引来双虎，战后回原马重试'}。战败扣一格勇气。` : t.phase === 'result' ? game.notice : t.feedback) : t.phase === 'intro' ? (t.trigger === 'finale' ? '七马归位！本次为四道攻击的高难度终战，战后开启档案。' : t.trigger === 'chapter' ? '四组人马已归位，器耳双虎苏醒。章节试炼仅此一次。' : '驯马超时，惊动了器耳双虎。击退它们就能回去重试。') : t.phase === 'result' ? t.result === 'success' ? backLine : game.difficulty === 'novice' ? '勇敢尝试，真棒！新手不扣海贝，' + backLine : '扣除现有海贝30%，已归位人马和道具保留，' + backLine : t.feedback || 'A 连续挥击；看准外圈进入绿环，按 B 闪避反击。';
      $('tiger-hp').textContent = t.hp;
      $('tiger-maxhp').textContent = t.maxHp;
      $('player-hp').textContent = t.playerHp;
      $('player-maxhp').textContent = t.playerMaxHp;
      $('attack-damage').textContent = t.attackDamage;
      $('tiger-health-fill').style.width = `${t.hp / t.maxHp * 100}%`;
      $('player-health-fill').style.width = `${t.playerHp / t.playerMaxHp * 100}%`;
      $('attack-cooldown').textContent = `${Math.max(0, t.attackCooldown).toFixed(1)}s`;
      $('combat-round').textContent = `第${t.wave}轮 · ${dodgeCue.pending}/${t.strikes.length}道攻击`;
      $('attack-button').disabled = !['ring', 'recover'].includes(t.phase) || t.attackCooldown > 0;
      $('dodge-button').disabled = t.phase !== 'ring';
    }
  }
  function visibleButtons() {
    const scope = ui.overlay === 'shop' && ui.pendingPurchase ? $('modal').querySelector('.purchase-prompt') || $('modal') : ui.overlay ? $('modal') : game.state === 'title' ? $('title-screen') : game.state === 'archive' ? $('archive-screen') : $('stage');
    const buttons = [...scope.querySelectorAll('button:not(:disabled),input[type="range"]:not(:disabled)')];
    if (!ui.overlay && game.state === 'title') buttons.push(...$('topbar').querySelectorAll('button:not(:disabled)'));
    return buttons.filter(button => button.getClientRects().length);
  }
  // 手柄左右键微调聚焦中的音量滑杆（键盘方向键走原生行为）；上下键仍用于切换焦点。
  function adjustFocusedVolume(code) {
    const input = document.activeElement;
    if (!input || typeof input.matches !== 'function' || !input.matches('input[data-volume]')) return false;
    if (!['ArrowLeft', 'ArrowRight'].includes(code)) return false;
    const step = Number(input.step) || 5;
    const delta = code === 'ArrowLeft' ? -step : step;
    const value = Math.max(0, Math.min(100, Number(input.value) + delta));
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function moveFocus(delta) {
    const buttons = visibleButtons();
    let index = buttons.indexOf(document.activeElement);
    index = (index + delta + buttons.length) % buttons.length;
    if (buttons[index]) { buttons[index].focus({ preventScroll: false }); Sound.play('select'); }
  }
  function press(code) {
    if (globalThis.GameIntro && globalThis.GameIntro.active) { globalThis.GameIntro.key(code); return; }
    if (code === 'Escape') {
      if (['ready', 'errand', 'endless'].includes(ui.overlay)) openOverlay('pause'); else if (ui.overlay) closeOverlay(); else openOverlay('pause'); return;
    }
    if (code === 'KeyM' && !ui.overlay) { openOverlay('museum'); return; }
    if (code === 'KeyS' && !ui.overlay) { perform('shop'); return; }
    if (!ui.overlay && game.state === 'taming' && game.taming.tutorial && (code === 'Enter' || code.startsWith('Shift'))) { perform('tutorial-skip'); return; }
    if (ui.overlay === 'ready') {
      if (code === 'Space' || code === 'Enter') perform('ready-start');
      else if (code.startsWith('Shift')) closeOverlay();
      return;
    }
    if (['BracketLeft', 'BracketRight'].includes(code) && ['shop', 'museum'].includes(ui.overlay)) {
      const step = code === 'BracketLeft' ? -1 : 1;
      const action = ui.overlay === 'shop' ? 'shop-page' : 'page';
      const button = $('modal').querySelector(`[data-act="${action}"][data-step="${step}"]:not(:disabled)`);
      if (button) perform(action, button);
      return;
    }
    if (['PageUp', 'PageDown'].includes(code)) {
      const target = ui.overlay === 'museum' ? $('modal').querySelector('.museum-detail') : ui.overlay === 'official' ? $('modal').querySelector('.modal-body') : game.state === 'archive' && !ui.overlay ? $('archive-screen') : null;
      if (target) target.scrollTop += code === 'PageUp' ? -190 : 190;
      return;
    }
    if (ui.overlay === 'errand') {
      if (code.startsWith('Shift')) { if (ui.padSource) closeOverlay(); else ui.errandShift = code; }
      else if (code.startsWith('Arrow')) {
        ui.errandIndex = (ui.errandIndex + (['ArrowLeft', 'ArrowUp'].includes(code) ? 2 : 1)) % 3;
        Sound.play('select'); renderModal();
      } else if (code === 'Space' || code === 'Enter') {
        const focused = document.activeElement;
        if (focused?.dataset.act === 'close') closeOverlay();
        else perform('errand-select', focused?.dataset.act === 'errand-select' ? focused : { dataset: { id: Core.ERRANDS[ui.errandIndex].id } });
      }
      return;
    }
    if (ui.overlay === 'difficulty') {
      if (code.startsWith('Shift')) { closeOverlay(); return; }
      if (code.startsWith('Arrow')) {
        const current = difficultyKeys.indexOf(game.difficulty);
        const next = (current + (['ArrowLeft', 'ArrowUp'].includes(code) ? difficultyKeys.length - 1 : 1)) % difficultyKeys.length;
        Core.setDifficulty(game, difficultyKeys[next]); Sound.play('select'); renderModal(); updateHud(); return;
      }
      if (code === 'Space' || code === 'Enter') { perform('new'); return; }
    }
    if (ui.overlay || ['title', 'archive'].includes(game.state)) {
      if (code.startsWith('Shift')) { if (ui.overlay) closeOverlay(); return; }
      if (code.startsWith('Arrow')) { if (adjustFocusedVolume(code)) { Sound.play('select'); return; } moveFocus(['ArrowLeft', 'ArrowUp'].includes(code) ? -1 : 1); return; }
      if (code === 'Space' || code === 'Enter') {
        const buttons = visibleButtons();
        const active = buttons.includes(document.activeElement) ? document.activeElement : buttons[0];
        if (active) active.click();
      }
      return;
    }
    if (game.state === 'map') {
      if (code.startsWith('Arrow')) {
        ui.selection = code === 'ArrowUp' ? game.selectedHorse : code === 'ArrowDown' ? 7 : (game.selectedHorse + (code === 'ArrowLeft' ? 6 : 1)) % 7;
        if (ui.selection < 7) game.selectedHorse = ui.selection;
        selectBronze(ui.selection);
        Sound.play('select');
        updateViews(); focusFirst();
      } else if (code === 'Space' || code === 'Enter') perform(ui.selection === 7 ? 'shop' : 'start');
    } else if (game.state === 'tiger') {
      if (code.startsWith('Shift')) dodgeTiger();
      else if (code === 'Space' || code === 'Enter') attackTiger();
    }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-act]');
    if (button && !button.disabled) perform(button.dataset.act, button);
  });
  document.addEventListener('input', event => {
    const input = event.target.closest && event.target.closest('input[data-volume]');
    if (!input) return;
    const key = input.dataset.volume, value = Number(input.value) / 100;
    if (key === 'music') {
      if (typeof Sound.setMusicVolume === 'function') Sound.setMusicVolume(value);
    } else {
      if (typeof Sound.setSfxVolume === 'function') Sound.setSfxVolume(value);
      if (typeof Voice.setVolume === 'function') Voice.setVolume(value);
    }
    const label = $('volume-' + key + '-value');
    if (label) label.textContent = Math.round(value * 100) + '%';
    input.setAttribute('aria-valuetext', Math.round(value * 100) + '%');
  });
  document.addEventListener('change', event => {
    const input = event.target.closest && event.target.closest('input[data-volume]');
    if (!input) return;
    const key = input.dataset.volume, value = Number(input.value) / 100;
    Core.save.setSetting(key === 'music' ? 'musicVolume' : 'sfxVolume', value);
    if (key === 'sfx' && Sound.enabled) Sound.play('ui');
  });
  window.addEventListener('keydown', event => {
    // 音量滑杆保留浏览器原生的左右微调与空格；上下键、Shift、Tab 仍交给游戏导航，避免焦点被困在滑杆上。
    if (event.target && event.target.closest && event.target.closest('input[data-volume]') && ['ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(event.code)) return;
    // 昵称输入框保留文字输入；Enter 保存，Esc 仍可返回档案。
    if (event.target && event.target.closest && event.target.closest('#board-name')) {
      if (event.isComposing) return;
      if (event.code === 'Enter') { event.preventDefault(); perform('rename-leaderboard'); return; }
      if (event.code !== 'Escape' && event.code !== 'Tab') return;
    }
    if (event.code === 'Tab' && !ui.overlay && game.state === 'map') ui.mapFocusIntent = true;
    if (event.code === 'Tab' && ui.overlay) { ui.errandShift = null; event.preventDefault(); moveFocus(event.shiftKey ? -1 : 1); return; }
    if (['Space', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight', 'KeyM', 'KeyS', 'BracketLeft', 'BracketRight', 'PageUp', 'PageDown'].includes(event.code)) {
      event.preventDefault(); if (event.repeat || physicalKeys.has(event.code)) return;
      Sound.unlock();
      const confirm = event.code === 'Space' || event.code === 'Enter';
      const confirmAlreadyHeld = physicalKeys.has('Space') || physicalKeys.has('Enter') || ui.lastPad[0];
      physicalKeys.add(event.code);
      // A fresh physical press is usable immediately; only a held transition key is gated.
      keys.add(event.code); if (event.code === 'Space') ui.gate = false;
      ui.padSource = false;
      if (!confirm || !confirmAlreadyHeld) press(event.code);
    }
  });
  window.addEventListener('keyup', event => {
    physicalKeys.delete(event.code); keys.delete(event.code); if (event.code === 'Space') ui.gate = false;
    if (ui.errandShift === event.code) { ui.errandShift = null; if (ui.overlay === 'errand') closeOverlay(); }
  });
  for (const [id, center] of [['start-horse', false], ['map-shop', true]]) {
    $(id).addEventListener('focus', () => {
      if (game.state !== 'map' || ui.overlay) return;
      const selection = center ? 7 : game.selectedHorse;
      if (ui.mapFocusIntent) { selectBronze(selection); ui.mapFocusIntent = false; }
      if (ui.selection !== selection) { ui.selection = selection; updateViews(); }
    });
  }
  $('hold-button').addEventListener('pointerdown', event => { if (!ui.overlay && game.state === 'taming') { Sound.unlock(); event.preventDefault(); ui.mouseHold = true; $('hold-button').setPointerCapture(event.pointerId); } });
  window.addEventListener('pointerup', () => { ui.mouseHold = false; });
  window.addEventListener('pointercancel', () => { ui.mouseHold = false; });
  canvas.addEventListener('click', event => {
    if (game.state !== 'map' || ui.overlay) return;
    if (bronze && bronze.ready) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * 1280 / rect.width, y = (event.clientY - rect.top) * 720 / rect.height;
    const anchors = sceneAnchors(false);
    for (let i = 0; i < 7; i++) { const point = anchors.points[i]; if (Math.hypot(x - point[0], y - point[1]) < 48) { ui.selection = i; game.selectedHorse = i; selectBronze(i); updateViews(); return; } }
    if (Math.hypot(x - anchors.center[0], y - anchors.center[1]) < 60) perform('shop');
  });
  window.addEventListener('blur', () => { physicalKeys.clear(); flushInputs(); if (!ui.overlay && ['map', 'taming', 'tiger', 'victory'].includes(game.state)) openOverlay('pause'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { physicalKeys.clear(); flushInputs(); if (!ui.overlay && game.state !== 'title') openOverlay('pause'); } ui.lastTime = 0; });
  // 手柄震动反馈：Chrome/Edge 走 vibrationActuator.playEffect，Firefox 走 hapticActuators[0].pulse。
  let activePad = null;
  let lastRumbleAt = 0;
  const haptics = { inside: null, tutorialStep: null, hitFlash: 0, dodged: false, tigerResult: '' };
  function rumble(strong, weak, duration) {
    if (!activePad) return;
    const now = performance.now();
    if (now - lastRumbleAt < 45) return; // 同帧多个事件只震一次，避免连成一片。
    lastRumbleAt = now;
    const actuator = activePad.vibrationActuator || (Array.isArray(activePad.hapticActuators) && activePad.hapticActuators[0]) || null;
    if (!actuator) return;
    const magnitude = value => Math.max(0, Math.min(1, value));
    try {
      if (typeof actuator.playEffect === 'function') {
        actuator.playEffect('dual-rumble', { duration: Math.round(duration), strongMagnitude: magnitude(strong), weakMagnitude: magnitude(weak) }).catch(() => {});
      } else if (typeof actuator.pulse === 'function') {
        actuator.pulse(magnitude(strong), Math.round(duration)).catch(() => {});
      }
    } catch (_) { /* 手柄不支持震动时静默降级，不影响游戏。 */ }
  }
  function pollGamepad() {
    let pad = null;
    try { pad = typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()).find(p => p && p.connected && p.mapping === 'standard') : null; } catch (_) { /* Keyboard remains available if device access is denied. */ }
    if (pad) {
      activePad = pad;
      const now = pad.buttons.map(button => button.pressed);
      if (!now[0]) ui.padGate = false;
      const bindings = { 0: 'Space', 1: 'ShiftLeft', 4: 'BracketLeft', 5: 'BracketRight', 6: 'PageUp', 7: 'PageDown', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
      for (const [index, code] of Object.entries(bindings)) if (now[index] && !ui.lastPad[index]) {
        if (index === '0' && (physicalKeys.has('Space') || physicalKeys.has('Enter'))) continue;
        Sound.unlock(); ui.padSource = true; press(code);
        if (index === '0') rumble(0.35, 0.4, 100); // A 确认
        else if (index === '1') rumble(0.18, 0.2, 70); // B 返回
        else if (['12', '13', '14', '15'].includes(index)) rumble(0.1, 0.12, 55); // 方向键轻扫
      }
      ui.lastPad = now; ui.padConnected = true;
      $('device-status').textContent = '标准手柄已连接 · A 确认 / B 返回';
      return !!now[0] && !ui.padGate;
    }
    if (ui.padConnected && ui.padSource && (!ui.overlay || ui.overlay === 'errand') && ['map', 'taming', 'tiger'].includes(game.state)) { openOverlay('pause'); toast('手柄已断开，可使用键盘继续。'); }
    activePad = null;
    ui.padConnected = false; ui.lastPad = [];
    $('device-status').textContent = '键盘就绪 · 手柄按任意键识别';
    return false;
  }

  // Code silhouettes provide a fallback while the embedded reference-based art loads.
  function path(points, fill = false) {
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(...point) : ctx.moveTo(...point));
    if (fill) { ctx.closePath(); ctx.fill(); } else ctx.stroke();
  }
  function human(x, y, scale, color, seated = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.ellipse(0, -26, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-1, -34, 2.8, 0, Math.PI * 2); ctx.fill();
    path([[-3, -20], [-6, -4], [6, -4], [4, -20]], true);
    path([[-3, -16], [-10, -7], [-17, -8]]); path([[4, -16], [13, -13], [20, -17]]);
    if (seated) { path([[-3, -4], [-13, 2], [-13, 15]]); path([[5, -4], [15, 2], [17, 15]]); }
    else { path([[-3, -4], [-5, 15], [-10, 16]]); path([[4, -4], [8, 15], [13, 16]]); }
    ctx.restore();
  }
  function horse(x, y, scale, color, flip = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -scale : scale, scale); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-28, -7); ctx.bezierCurveTo(-29, -24, -1, -25, 18, -15); ctx.lineTo(23, -37); ctx.lineTo(34, -45); ctx.lineTo(39, -59); ctx.lineTo(42, -46); ctx.lineTo(50, -43); ctx.lineTo(55, -32); ctx.lineTo(48, -29); ctx.lineTo(39, -34); ctx.lineTo(34, -7); ctx.bezierCurveTo(22, 8, -10, 8, -24, -2); ctx.closePath(); ctx.fill();
    path([[-21, -2], [-23, 20], [-33, 35], [-23, 35], [-12, 19], [-8, 4]], true);
    path([[17, 0], [15, 23], [29, 33], [36, 33], [26, 18], [29, -1]], true);
    path([[-16, 2], [-9, 23], [-2, 33], [4, 33], [-1, 17]], false);
    path([[23, -2], [35, 15], [47, 24], [40, 25], [24, 17]], false);
    ctx.beginPath(); ctx.moveTo(-26, -13); ctx.bezierCurveTo(-41, -15, -37, 8, -49, 14); ctx.stroke();
    ctx.strokeStyle = '#12251b'; ctx.lineWidth = 1.3; path([[30, -37], [39, -27], [49, -29]]); ctx.beginPath();ctx.arc(45,-39,1.6,0,7);ctx.fillStyle='#102217';ctx.fill();
    ctx.restore();
  }
  function ring(cx, cy, r, time, title = false) {
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, r * .3, cx, cy, r * 1.5); glow.addColorStop(0, '#55795622'); glow.addColorStop(.7, '#47653b11'); glow.addColorStop(1, '#111c1800'); ctx.fillStyle = glow; ctx.fillRect(cx-r*1.5, cy-r*1.5, r*3, r*3);
    ctx.shadowColor = '#000a'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 18;
    const plate = ctx.createRadialGradient(cx-r*.2, cy-r*.3, 0, cx, cy, r); plate.addColorStop(0,'#354c39');plate.addColorStop(.7,'#263b2b');plate.addColorStop(1,'#101e17');
    ctx.fillStyle = plate; ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    [1,.97,.90,.87,.43,.40].forEach((value,i)=>{ctx.strokeStyle=i<2?'#a38e5799':'#a38e5738';ctx.lineWidth=i===0?2:1;ctx.beginPath();ctx.arc(cx,cy,r*value,0,Math.PI*2);ctx.stroke();});
    for(let i=0;i<70;i++){const a=i*Math.PI*2/70;ctx.strokeStyle=i%10===0?'#dbc38688':'#b5a16a33';ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r*.91,cy+Math.sin(a)*r*.91);ctx.lineTo(cx+Math.cos(a)*r*.955,cy+Math.sin(a)*r*.955);ctx.stroke();}
    for(let i=0;i<7;i++){
      const a=-Math.PI/2+i*Math.PI*2/7;const x=cx+Math.cos(a)*r*.725,y=cy+Math.sin(a)*r*.725;
      const done=game.completed[i]&&!title,active=!title&&(ui.selection===i&&game.state==='map'||game.activeHorse===i);
      if(active){ctx.fillStyle='#e8d29b10';ctx.strokeStyle='#d6bf7c77';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,52,0,Math.PI*2);ctx.fill();ctx.stroke();}
      const color=done?'#c6b985':active?'#d8c48d':title?'#8e9b70':'#758269';
      const s=title?.66:.64;
      horse(x+11,y-1,s,color,i>3);human(x-33,y-4,s*.85,color);
      ctx.strokeStyle=color;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x-21,y-12);ctx.quadraticCurveTo(x+2,y+5,x+(i>3?-19:40),y-21);ctx.stroke();
      ctx.fillStyle=done?'#d8d0a2':active?'#eed49a':'#8a997c';ctx.font='11px Georgia';ctx.textAlign='center';ctx.fillText(done?'✓ 归位':String(i+1).padStart(2,'0'),x,y+45);
    }
    const centerColor=!title&&ui.selection===7?'#e0c78d':'#a4a172';
    ctx.strokeStyle='#aa996448';ctx.beginPath();ctx.ellipse(cx,cy+25,42,14,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.ellipse(cx,cy+33,42,14,0,0,Math.PI);ctx.stroke();
    human(cx,cy+6,1.15,centerColor,true);human(cx-39,cy-8,.8,centerColor);human(cx+38,cy+21,.65,centerColor,true);
    ctx.strokeStyle=centerColor;ctx.lineWidth=1.4;path([[cx-53,cy-6],[cx-53,cy-65],[cx-46,cy-70]]); // Missing canopy is deliberate.
    ctx.fillStyle='#a8ac85';ctx.font='10px "Microsoft YaHei"';ctx.textAlign='center';ctx.fillText('中央三人',cx,cy+68);
    if(!title&&ui.selection===7&&game.state==='map'){ctx.strokeStyle='#e0c78d';ctx.setLineDash([3,6]);ctx.beginPath();ctx.arc(cx,cy,r*.42,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    ctx.restore();
  }
  function tiger(x,y,s,flip){
    ctx.save();ctx.translate(x,y);ctx.scale(flip?-s:s,s);ctx.fillStyle='#917c4b';ctx.strokeStyle='#b39b61';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(-80,22);ctx.bezierCurveTo(-92,-25,-19,-51,28,-23);ctx.lineTo(38,-64);ctx.lineTo(61,-80);ctx.lineTo(86,-70);ctx.lineTo(93,-49);ctx.lineTo(72,-39);ctx.lineTo(60,-14);ctx.lineTo(54,29);ctx.lineTo(24,54);ctx.lineTo(17,46);ctx.lineTo(29,17);ctx.lineTo(-25,25);ctx.lineTo(-56,60);ctx.lineTo(-68,53);ctx.lineTo(-59,14);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-76,0);ctx.bezierCurveTo(-134,-20,-100,-88,-80,-65);ctx.bezierCurveTo(-69,-52,-86,-43,-92,-53);ctx.stroke();
    ctx.fillStyle='#101c14';ctx.beginPath();ctx.arc(73,-60,3,0,7);ctx.fill();path([[78,-46],[87,-48],[85,-37],[75,-35]],true);
    ctx.strokeStyle='#263523';ctx.lineWidth=5;[-50,-22,4].forEach(v=>path([[v,-16],[v+13,0],[v+3,9]]));ctx.restore();
  }
  function imageReady(key) {
    return artImages[key] && artImages[key].complete && artImages[key].naturalWidth > 0;
  }
  function sceneAnchors(title) {
    const box = title ? { x: 575, y: 138, w: 665, h: 443.333 } : { x: 40, y: 98, w: 790, h: 526.667 };
    if (!title && game.state === 'map' && bronze && bronze.ready) {
      const projected = bronze.anchors();
      if (projected.points.length === 7) return { box, ...projected };
    }
    if (imageReady('artifact')) {
      const data = globalThis.GameArt.artifact;
      return { box, points: data.anchors.map(p => [box.x + p[0] * box.w, box.y + p[1] * box.h]), center: [box.x + data.center[0] * box.w, box.y + data.center[1] * box.h] };
    }
    return { box, points: Array.from({length: 7}, (_,i) => { const a=-Math.PI/2+i*Math.PI*2/7; return [447+Math.cos(a)*174,369+Math.sin(a)*174]; }), center: [447,369] };
  }
  function artifactScene(time, title) {
    if (!title && game.state === 'map' && bronze && bronze.ready) return;
    if (title && imageReady('hero')) {
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(artImages.hero, 606, 78, 600, 600); ctx.restore(); return;
    }
    if (!imageReady('artifact')) { ring(title ? 930 : 447, title ? 366 : 369, title ? 245 : 240, time, title); return; }
    const layout = sceneAnchors(title);
    const box = layout.box;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(artImages.artifact, box.x, box.y, box.w, box.h);
    if (!title) {
      layout.points.forEach((point, index) => {
        const done = game.completed[index];
        const active = (game.state === 'map' && ui.selection === index) || (game.state === 'taming' && game.activeHorse === index);
        if (active) {
          const pulse = ui.reduced ? .7 : .65 + Math.sin(time * 2.4) * .15;
          ctx.globalAlpha = pulse; ctx.strokeStyle = '#e7d59c'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(point[0], point[1] - 2, 49, 19, -.13, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
          if (game.state === 'taming') {
            ctx.strokeStyle = '#add7b0'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(point[0], point[1] - 2, 49, 19, -.13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * game.taming.progress); ctx.stroke();
          }
        }
        const x = point[0], y = point[1] + 23;
        ctx.fillStyle = active ? '#d8bc7c' : done ? '#315a46ed' : '#10271dd9';
        ctx.strokeStyle = done ? '#b0c797' : active ? '#f2dfb1' : '#a3ad7d88'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(x - 15, y - 11, 30, 22, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = active ? '#1b281b' : done ? '#d5e6b7' : '#d3d4ae'; ctx.font = '11px Georgia'; ctx.textAlign = 'center';
        ctx.fillText(done ? '✓' : String(index + 1).padStart(2, '0'), x, y + 4);
      });
      if (ui.selection === 7 && game.state === 'map') {
        ctx.strokeStyle = '#e6d19b'; ctx.setLineDash([3,5]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(layout.center[0], layout.center[1], 83, 36, -.08, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }
  function tamingScene() {
    const cue = Core.getTamingCue(game, holdingReins());
    const b = cue.posture === 'settled' ? 0 : cue.balance;
    const lift = Math.max(0, b), reach = Math.max(0, -b);
    // No decorative movement when reduced motion or paused; state poses remain.
    const breath = ui.reduced || ui.overlay ? 0 : Math.sin(game.taming.elapsed * 3) * 0.8;
    const bodyX = 564, bodyY = 432 - lift * 10 + breath, angle = lift * 0.14;
    const headY = -58 - b * 18;
    const toWorld = (x, y) => [bodyX + Math.cos(angle) * x - Math.sin(angle) * y, bodyY + Math.sin(angle) * x + Math.cos(angle) * y];
    const mouth = toWorld(-130 - reach * 5, headY + 5);
    const lean = -b * 18 - (cue.holding ? 6 : 0);
    const hand = [304 + lean * 0.4, 387 - lift * 5];
    const color = cue.inside ? '#b3c69a' : '#d7b77a';
    ctx.save();
    const veil = ctx.createLinearGradient(74,128,74,620);
    veil.addColorStop(0,'#13271af5'); veil.addColorStop(.6,'#102218ed'); veil.addColorStop(1,'#102018fa');
    ctx.fillStyle=veil; ctx.strokeStyle='#a99c6247'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(74,128,752,492,12); ctx.fill(); ctx.stroke();

    // Keep the selected group's original location visible beside its enlargement.
    if (imageReady('artifact')) {
      ctx.drawImage(artImages.artifact,83,141,148,99);
      const anchor=globalThis.GameArt.artifact.anchors[game.activeHorse];
      const x=83+anchor[0]*148,y=141+anchor[1]*99;
      ctx.strokeStyle='#f2d598';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,10,6,0,0,Math.PI*2);ctx.stroke();
    } else {
      for(let i=0;i<7;i++) { const a=-Math.PI/2+i*Math.PI*2/7;
        ctx.fillStyle=i===game.activeHorse?'#f2d598':'#637e61';ctx.beginPath();ctx.arc(155+Math.cos(a)*39,185+Math.sin(a)*28,4,0,7);ctx.fill(); }
    }
    ctx.strokeStyle='#bcad6b55';ctx.setLineDash([3,5]);
    path([[160,238],[160,257],[245,287]]);ctx.setLineDash([]);

    // The ground arc records progress at the pair's feet, in the same sightline.
    ctx.fillStyle='#07140dc0';ctx.beginPath();ctx.ellipse(465,501,264,32,0,0,7);ctx.fill();
    ctx.strokeStyle='#68846055';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(465,501,264,32,0,0,7);ctx.stroke();
    ctx.strokeStyle=cue.inside?'#bad4a0':'#c9a66d';ctx.lineWidth=3;
    ctx.beginPath();ctx.ellipse(465,501,264,32,0,-Math.PI/2,-Math.PI/2+Math.PI*2*cue.progress);ctx.stroke();

    // Articulated bronze horse, facing the trainer. All movement follows balance.
    ctx.save();ctx.translate(bodyX,bodyY);ctx.rotate(angle);
    const bronze=ctx.createLinearGradient(-140,-120,90,75);
    bronze.addColorStop(0,'#c2c199');bronze.addColorStop(.45,'#6e9879');bronze.addColorStop(.8,'#385d48');bronze.addColorStop(1,'#a7ac78');
    ctx.fillStyle=bronze;ctx.strokeStyle='#b5bf8b';ctx.lineWidth=2;ctx.lineJoin='round';
    // Far legs, then torso and jointed foreground legs.
    ctx.globalAlpha=.65;
    path([[-48,3],[-58,42-lift*30],[-94,66-lift*46],[-73,66-lift*46],[-32,35],[-21,0]],true);
    path([[47,4],[65,43],[96,69],[80,71],[41,46],[28,4]],true);ctx.globalAlpha=1;
    ctx.beginPath();ctx.moveTo(-70,-36);ctx.bezierCurveTo(-34,-69,60,-54,81,-25);ctx.bezierCurveTo(100,15,36,29,-33,9);ctx.lineTo(-63,-4);ctx.closePath();ctx.fill();ctx.stroke();
    path([[-48,1],[-60,40-lift*38],[-103,66-lift*62],[-79,68-lift*62],[-38,43-lift*24],[-20,7]],true);
    path([[46,8],[50,46],[72,77],[90,77],[67,39],[72,-4]],true);
    ctx.beginPath();ctx.moveTo(77,-25);ctx.bezierCurveTo(116,-28,101,22,128,35+reach*6);ctx.stroke();
    // Neck and head rise before the boundary; rearing becomes larger outside it.
    ctx.beginPath();ctx.moveTo(-37,-30);ctx.lineTo(-74,headY-17);ctx.lineTo(-106,headY-31);
    ctx.lineTo(-113,headY-52);ctx.lineTo(-123,headY-31);ctx.lineTo(-143,headY-19);
    ctx.lineTo(-150,headY+2);ctx.lineTo(-130-reach*5,headY+10);ctx.lineTo(-106,headY+4);
    ctx.lineTo(-80,headY+30);ctx.lineTo(-64,2);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle='#163c2b';ctx.lineWidth=4;path([[-61,-25],[-87,headY-10],[-104,headY-23]]);
    ctx.fillStyle='#081d12';ctx.beginPath();ctx.arc(-126,headY-15,3,0,7);ctx.fill();
    // Visible bridle ties the rein to the muzzle rather than to the instrument.
    ctx.strokeStyle='#e0c98b';ctx.lineWidth=2.4;
    path([[-138,headY-17],[-130-reach*5,headY+9],[-108,headY+3],[-113,headY-26]]);
    if(game.upgrades.bell) {
      ctx.fillStyle='#d5ba79';ctx.beginPath();ctx.arc(-83,headY+24,6,Math.PI,Math.PI*2);ctx.lineTo(-76,headY+34);ctx.lineTo(-90,headY+34);ctx.closePath();ctx.fill();
    }
    ctx.restore();

    // Trainer's planted feet, reaching arms and backward lean make tension legible.
    ctx.save();ctx.translate(252,494);ctx.strokeStyle='#b8be89';ctx.lineWidth=5;ctx.lineJoin='round';
    path([[-13,-50],[-29,-15],[-43,5],[-18,5]]);path([[5,-50],[21,-12],[35,5],[12,5]]);
    ctx.fillStyle='#759578';ctx.beginPath();ctx.moveTo(lean-12,-124);ctx.lineTo(lean+11,-124);ctx.lineTo(14,-49);ctx.lineTo(-22,-49);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#bbbd8d';ctx.beginPath();ctx.ellipse(lean,-143,12,15,-.12,0,7);ctx.fill();
    ctx.beginPath();ctx.arc(lean-3,-162,6,0,7);ctx.fill();
    ctx.strokeStyle='#c4c797';ctx.lineWidth=5;
    path([[lean+5,-112],[28+lean*.5,-91],[hand[0]-252,hand[1]-494]]);
    path([[lean-8,-109],[18+lean*.5,-79],[hand[0]-250,hand[1]-489]]);
    ctx.strokeStyle='#ddc893';ctx.lineWidth=3;path([[-15,-63],[12,-63]]);ctx.restore();

    // Taut straight rein versus slack hanging curve, plus a distinct long-rope mark.
    const sag=cue.posture==='settled'?33:Math.max(0,1-b)*23+(cue.holding?0:12);
    ctx.strokeStyle=color;ctx.lineWidth=game.upgrades.rope?3.5:2.5;
    ctx.beginPath();ctx.moveTo(...hand);ctx.quadraticCurveTo((hand[0]+mouth[0])/2,(hand[1]+mouth[1])/2+sag,...mouth);ctx.stroke();
    if(game.upgrades.rope) {ctx.fillStyle='#dfc780';ctx.beginPath();ctx.arc(hand[0]+15,hand[1]+8,4,0,7);ctx.fill();}
    ctx.fillStyle='#b5c5a8';ctx.font='11px "Microsoft YaHei"';ctx.textAlign='center';
    ctx.fillText(cue.holding?'正在收缰':'已经松缰',283,285);
    ctx.fillText(game.upgrades.bell?'马颈铜铃 · 节奏已放缓':cue.inside?'步态平稳 · 默契增长':'留意马首与前蹄',584,263);
    ctx.restore();
  }
  function battleScene(time) {
    const t = game.tiger;
    ctx.save();
    const shake = !ui.reduced && t.playerHitFlash > 0 ? Math.sin(time * 70) * t.playerHitFlash * 8 : 0;
    ctx.translate(shake,0);
    const cue = Core.getDodgeCue(game);
    for (let index = 0; index < t.fighters.length; index++) {
      const fighter = t.fighters[index], direction = index === 0 ? 1 : -1;
      const active = fighter.phase === 'strike';
      const ready = index === t.activeTiger && cue.ready;
      const x = index === 0 ? 235 : 615, y = 405;
      // Each tiger moves on its own strike/impact state. Essential timing rings
      // remain in reduced-motion mode; decorative movement is suppressed.
      const lunge = ui.reduced ? 0 : fighter.lunge / .28 * 28;
      const lean = ui.reduced || !active ? 0 : fighter.charge * 9;
      const lift = ui.reduced || !active ? 0 : Math.sin(fighter.charge * Math.PI) * 5;
      ctx.save(); ctx.translate(direction * (lunge + lean), -lift);
      ctx.filter = fighter.hitFlash > 0 ? `brightness(${1 + fighter.hitFlash * 2})` : 'none';
      if (imageReady('tigers')) {
        const sprite = artImages.tigers, half = sprite.naturalWidth / 2;
        ctx.drawImage(sprite, index * half, 0, half, sprite.naturalHeight, index === 0 ? 26 : 474, 155, 350, 467);
      } else tiger(index === 0 ? 265 : 624,375,1.1,index === 1);
      ctx.filter = 'none'; ctx.restore();

      ctx.textAlign = 'center'; ctx.font = '600 22px "Microsoft YaHei"';
      ctx.fillStyle = ready ? '#d8f3c4' : active ? '#f0d99f' : '#a8b69a';
      ctx.fillText(fighter.name + (index === 0 ? ' · 快扑' : ' · 重扑'), x, 202);
      ctx.font = '16px "Microsoft YaHei"';
      ctx.fillText(ready ? '现在闪避！' : active ? `${fighter.pending}道攻击正在逼近` : fighter.phase === 'windup' ? '准备同时进攻' : fighter.phase === 'recover' ? '扑击后休整' : fighter.phase === 'done' ? '试炼结束' : '等待接招', x, 230);
      if (fighter.hitFlash > 0) {
        ctx.strokeStyle = '#ffe0a5'; ctx.lineWidth = 2.5; ctx.globalAlpha = Math.min(1,fighter.hitFlash*5);
        path([[x-22,301],[x+22,353]]); path([[x-16,353],[x+16,301]]); ctx.globalAlpha=1;
      }
    }
    for (const strike of t.strikes) {
      if (strike.resolved) continue;
      const high = t.strikes.length === 4, scale = high ? .43 : .63;
      const x = high ? [160,540,310,690][strike.order - 1] : strike.side === 'left' ? 235 : 615;
      const y = 405, ready = cue.ready && strike.id === t.round;
      ctx.fillStyle = '#0d241cdb'; ctx.beginPath(); ctx.arc(x,y,73*scale,0,7); ctx.fill();
      ctx.strokeStyle = '#a5d2a2'; ctx.lineWidth = 24*scale; ctx.globalAlpha = .35;
      ctx.beginPath(); ctx.arc(x,y,60*scale,0,7); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#c4e7b3';
      ctx.beginPath(); ctx.arc(x,y,60*scale,0,7); ctx.stroke();
      ctx.strokeStyle = ready ? '#e7ffcd' : strike.id === t.round ? '#ecd69e' : '#b8c5a9';
      ctx.lineWidth = ready ? 3 : 2;
      ctx.beginPath(); ctx.arc(x,y,strike.radius*scale,0,7); ctx.stroke();
      ctx.fillStyle = '#e8e3bb'; ctx.font = `600 ${high ? 19 : 23}px "Microsoft YaHei"`;
      ctx.fillText(ready ? '闪'+strike.order : String(strike.order),x,y+7);
    }
    ctx.restore();
    ctx.fillStyle = '#a8b69a'; ctx.font = '11px "Microsoft YaHei"'; ctx.textAlign = 'center';
    ctx.fillText('双虎攻防为艺术想象 · 完美闪避可反击',425,633);
    ctx.fillStyle = '#83977e'; ctx.font = '9px Georgia'; ctx.fillText('ATTACK · DODGE · COUNTER',425,650);
  }
  function paint(time) {
    ctx.clearRect(0,0,1280,720); ctx.fillStyle='#0d1714'; ctx.fillRect(0,0,1280,720);
    if (game.state === 'title' && imageReady('cover')) {
      const art = artImages.cover, scale = Math.max(1280 / art.naturalWidth, 720 / art.naturalHeight);
      ctx.drawImage(art, (1280 - art.naturalWidth * scale) / 2, (720 - art.naturalHeight * scale) / 2, art.naturalWidth * scale, art.naturalHeight * scale);
      const veil = ctx.createLinearGradient(0, 0, 1280, 0);
      veil.addColorStop(0, '#05100ce6'); veil.addColorStop(.36, '#07120bd1'); veil.addColorStop(.62, '#07120b33'); veil.addColorStop(1, '#07120b0d');
      ctx.fillStyle = veil; ctx.fillRect(0, 0, 1280, 720);
      const rim = ctx.createLinearGradient(0, 530, 0, 720); rim.addColorStop(0, '#07120b00'); rim.addColorStop(1, '#07120bf0'); ctx.fillStyle=rim; ctx.fillRect(0,530,1280,190);
      return;
    }
    const light = ctx.createRadialGradient(game.state === 'title' ? 920 : 430,330,30,660,360,780);
    light.addColorStop(0,'#4e634430'); light.addColorStop(.65,'#263d2b18'); light.addColorStop(1,'#07120b00');
    ctx.fillStyle=light; ctx.fillRect(0,0,1280,720);
    ctx.strokeStyle='#9b9d6615'; ctx.lineWidth=1;
    for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(950,370,315+i*43,-.9,2.4);ctx.stroke();}
    for(let i=0;i<65;i++){const x=(i*197+37)%1240+20,y=(i*137+73)%650+30;ctx.fillStyle='#b0a36c12';ctx.fillRect(x,y,1,1);}
    if(game.state==='tiger') { battleScene(time); return; }
    const title = game.state === 'title'; artifactScene(time,title);
    if(game.state==='taming') { tamingScene(); return; }
    ctx.textAlign='center'; ctx.fillStyle='#c6c49e'; ctx.font='12px "Microsoft YaHei"';
    ctx.fillText(title ? '驯马场面铜贮贝器 · 全器意象重绘' : '十人七马 · 八组群像', title ? 920 : 436, title ? 625 : 635);
    ctx.fillStyle='#83977e'; ctx.font='9px Georgia';
    ctx.fillText('SCULPTED IN BRONZE · STORIES REAWAKENED',title ? 920 : 436,title ? 644 : 652);
  }
  function frame(now) {
    updateCuratorPose(now);
    const dt = ui.lastTime ? Math.min((now-ui.lastTime)/1000,.05) : 0;
    ui.lastTime=now;
    const padHold=pollGamepad();
    const holding=(keys.has('Space')&&!ui.gate)||ui.mouseHold||padHold;
    const completedBefore=game.completed.filter(Boolean).length;
    const cowriesBefore=game.cowries;
    const previousHorse=game.activeHorse;
    const milestoneBefore=previousHorse === null ? 0 : game.progressMilestones[previousHorse];
    const playerBefore=game.tiger && game.tiger.playerHp;
    if(!ui.overlay) ui.praiseRemaining = Math.max(0, ui.praiseRemaining - dt);
    if(!ui.overlay) Core.step(game,dt,{hold:holding});
    if(game.state==='taming' && game.activeHorse === previousHorse && game.progressMilestones[previousHorse] > milestoneBefore) {
      const milestone=game.progressMilestones[previousHorse];
      $('practice-praise').textContent = [null,'GOOD！25% · 找到节奏啦','GREAT！50% · 配合真好','PERFECT！75% · 就快成功啦'][milestone];
      ui.praiseRemaining=2.2; Sound.play(['good','great','perfect'][milestone-1]); rumble(0.25,0.45,130);
    }
    const dodgeCue=Core.getDodgeCue(game);
    if(dodgeCue && dodgeCue.ready && !ui.overlay && !game.paused) {
      if(ui.dodgeBattle!==game.tiger) { ui.dodgeBattle=game.tiger; ui.dodgeRound=0; }
      if(ui.dodgeRound!==dodgeCue.round) { ui.dodgeRound=dodgeCue.round; Sound.play('dodge-ready'); rumble(0.2,0.3,110); }
    }
    if(game.state==='taming' && game.taming) {
      if(game.taming.tutorial) {
        const stepName=game.taming.tutorial.step;
        if(haptics.tutorialStep && haptics.tutorialStep!==stepName) rumble(0.2,0.3,120); // 教学步骤完成
        haptics.tutorialStep=stepName; haptics.inside=null;
      } else {
        haptics.tutorialStep=null;
        if(game.taming.phase==='playing') {
          const inside=Core.getTamingCue(game).inside;
          if(haptics.inside!==null && haptics.inside!==inside) rumble(inside?0.15:0.45, inside?0.25:0.35, inside?70:150); // 进入绿区轻点，脱区重震
          haptics.inside=inside;
        } else haptics.inside=null;
      }
    } else { haptics.inside=null; haptics.tutorialStep=null; }
    if(game.state==='tiger' && game.tiger) {
      if(game.tiger.hitFlash>haptics.hitFlash+0.01) rumble(0.3,0.4,120); // 我方命中
      haptics.hitFlash=game.tiger.hitFlash;
      if(!haptics.dodged && game.tiger.dodged) rumble(0.55,0.65,180); // 完美闪避反击
      haptics.dodged=game.tiger.dodged;
      if(game.tiger.phase==='result' && game.tiger.result && haptics.tigerResult!==game.tiger.result) {
        haptics.tigerResult=game.tiger.result;
        if(game.tiger.result==='success') rumble(0.8,0.9,500); else rumble(0.5,0.45,350);
      }
      if(game.tiger.phase!=='result') haptics.tigerResult='';
    } else { haptics.hitFlash=0; haptics.dodged=false; haptics.tigerResult=''; }
    if(game.completed.filter(Boolean).length>completedBefore) {
      ui.errandAuto = game.pendingErrands > 0;
      const point=sceneAnchors(false).points[previousHorse] || [435,360];
      Effects.emit('success',...point,ui.reduced);
      const count=game.completed.filter(Boolean).length;
      rumble(0.8,0.9,450);
      const cheers=['第一颗星，送给你！','找到节奏啦，真棒！','三组归位，小能手！','一半多啦，继续加油！','配合越来越默契！','再一组就集齐啦！','小小博物馆探索家！'];
      celebrate({kind:count===7?'victory':'horse',title:cheers[count-1],detail:count===7?'你让器盖上的故事完整了，纪念章送给你！':'真棒！又有一组人马归位啦。',amount:game.cowries-cowriesBefore,count,score:count===7?null:game.lastHorseScore,grade:count===7?'':game.lastHorseGrade});
    }
    if(game.state==='tiger' && playerBefore>game.tiger.playerHp) { feedback('hit',425,378); rumble(0.9,0.7,260); }
    if(ui.lastState!==game.state){
      const prevState=ui.lastState;
      ui.lastState=game.state;ui.selection=game.selectedHorse;flushInputs();updateViews();
      if(game.state==='taming') rumble(0.2,0.3,110);
      if(game.state==='tiger') rumble(0.6,0.5,300);
      if(game.state==='victory') rumble(0.9,1,650);
      if(prevState==='taming' && game.state==='map' && game.completed.filter(Boolean).length===completedBefore) rumble(0.45,0.5,220); // 超时或中途退出
      if(game.state==='archive') focusFirst();
      if(['endless-break','endless-retry','endless-result'].includes(game.state)) {
        ui.pendingChallenge=null; clearReward(); Effects.clear(); openOverlay('endless');
      }
      if(game.state==='tiger') {
        clearReward(); Effects.clear(); $('toast').classList.remove('visible'); ui.toastUntil=0;
        ui.pendingChallenge={type:'tiger'}; openOverlay('ready');
      }
    }
    if(ui.lastNotice!==game.notice){ui.lastNotice=game.notice;if(game.notice && ui.overlay!=='ready')toast(game.notice);}
    if(ui.lastUnlocks!==game.unlocked.length){
      const delta=game.unlocked.length-ui.lastUnlocks;ui.lastUnlocks=game.unlocked.length;updateHud();
      if(delta>0){
        if(game.state!=='tiger') {
          if(!ui.rewardUntil) celebrate({kind:'collection',title:'新文物朋友，认识啦！',detail:`你的博物馆图鉴又点亮了 ${delta} 件宝藏。`});
          $('reward-collection').textContent=`图鉴 +${delta} · 已发现 ${game.unlocked.length} 件文物`;
        }
        $('collection-count').classList.add('reward-pop');
      }
    }
    Sound.update({state:game.state,overlay:ui.overlay,paused:!!ui.overlay||game.paused||document.hidden,hold:holding,progress:game.taming ? game.taming.progress : 0,duck:Voice.playing});
    if (bronze) {
      bronze.sync({ state: game.state, selected: ui.selection, completed: game.completed, paused: !!ui.overlay || game.paused || document.hidden, reduced: ui.reduced });
      bronze.update(dt);
    }
    liveReadouts();paint(ui.reduced?0:now/1000);
    Effects.draw(ctx,dt,now/1000,{reduced:ui.reduced,paused:!!ui.overlay||game.paused});
    if(ui.rewardUntil){
      const rewardNow=performance.now();
      if(ui.rewardAmount!==null && !ui.reduced) $('reward-number').textContent=Math.round(ui.rewardAmount*(1-Math.pow(1-Math.min(1,(rewardNow-ui.rewardStarted)/800),3)));
      if(rewardNow>=ui.rewardUntil) clearReward();
    }
    if (ui.errandAuto && game.state === 'map' && game.pendingErrands > 0 && !ui.overlay && !ui.rewardUntil) { updateViews(); openErrands(); }
    if (ui.wipeUntil && now >= ui.wipeUntil) {
      resetWipeConfirmation();
      const status = $('wipe-status');
      if (status) status.textContent = '确认已取消，家业保留。';
    }
    if(ui.toastUntil&&now>ui.toastUntil)$('toast').classList.remove('visible');
    requestAnimationFrame(frame);
  }
  $('official-text').textContent=Museum.officialText;
  updateViews();
  if (!Sound.enabled) toast('音效目前是关闭的：暂停菜单 → 音效与配音 可重新开启');
  requestAnimationFrame(frame);
})();
