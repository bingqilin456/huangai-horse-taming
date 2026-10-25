(function (root) {
  'use strict';

  const EPSILON = 1e-9;
  const HORSE_COUNT = 7;
  const INDUSTRY_CAP = 5;
  const SAVE_KEY = 'huanGai.save.v1';
  const ERRANDS = [
    { id: 'forage', name: '备草料', industry: '草料', description: '备些草料，马儿更服帖。', effect: '下一次训练绿区 ×1.12', lasting: '每级绿区 +1.5%' },
    { id: 'barn', name: '修马厩', industry: '马厩', description: '修修马厩，让马儿住得安稳。', effect: '本局后续每匹 +2 海贝', lasting: '每级每匹 +2 海贝' },
    { id: 'market', name: '赶集市', industry: '集市', description: '去集市张罗些急用。', effect: '立即 +10 海贝', lasting: '每级开局 +6 海贝' }
  ];
  const DIFFICULTIES = {
    novice: { name: '新手', reward: 30, duration: 20, upSpeed: 0.60, downSpeed: 0.72, gain: 0.20, decay: 0.04, widths: [0.60, 0.50, 0.44], amplitudes: [0, 0.06, 0.09], periods: [7, 7, 6], tigerDamage: 25 },
    normal: { name: '正常', reward: 50, duration: 12, upSpeed: 0.72, downSpeed: 0.90, gain: 0.18, decay: 0.09, widths: [0.32, 0.25, 0.20], amplitudes: [0, 0.12, 0.16], periods: [5, 4.5, 3.8], tigerDamage: 35 },
    veteran: { name: '老手', reward: 80, duration: 13, upSpeed: 0.85, downSpeed: 1.00, gain: 0.16, decay: 0.14, widths: [0.23, 0.16, 0.12], amplitudes: [0.06, 0.18, 0.23], periods: [4, 3.5, 3], tigerDamage: 40 },
    impossible: { name: '不可能', reward: 140, duration: 14, upSpeed: 0.95, downSpeed: 1.15, gain: 0.15, decay: 0.18, widths: [0.15, 0.10, 0.075], amplitudes: [0.10, 0.22, 0.27], periods: [3, 2.5, 2.2], tigerDamage: 50 }
  };
  const COMBAT = { hp: 120, playerHp: 100, attackDamage: 10, attackCooldown: 0.65, counterDamage: 15, intro: 0.8, ring: 1.8, rightRing: 2.1, recover: 0.6, pairRecover: 0.95, result: 1, minRadius: 48, maxRadius: 72 };
  // 评分只奖励可观察的表现：剩余时间、在绿区的时间、闪避与图鉴发现。
  const SCORE = {
    horseBase: 60, horseTime: 25, horseSteady: 15, retryPenalty: 10, retryPenaltyCap: 20,
    combatWin: 100, combatDodge: 3, combatDodgeCap: 30, combatLose: 20,
    timeoutWin: 60, timeoutDodgeCap: 15, timeoutLose: 10,
    explorePer: 8, exploreStart: 2,
    multiplier: { novice: 1, normal: 1.25, veteran: 1.5, impossible: 2 },
    grades: [[88, 'S', '天作之合'], [75, 'A', '默契十足'], [62, 'B', '渐入佳境'], [0, 'C', '再接再厉']]
  };
  // 本机排行榜只保存在本地，不联网，也不上传昵称。
  const DEFAULT_NICKNAME = '小小驯马师';
  const LEADERBOARD_LIMIT = 50;
  const SHOP = {
    rope: { price: 20, name: '长缰绳', unlock: 'container' },
    bell: { price: 25, name: '定马铜铃', unlock: 'bell' },
    gold: { price: 35, name: '剑鞘金饰', unlock: 'gold' },
    sword: { price: 65, name: '鎏金蛇头铜剑柄', unlock: 'sword' },
    fish: { price: 55, name: '铜鱼杖头铜饰', unlock: 'fish' },
    token: { price: 45, name: '圆形金片饰', unlock: 'token' }
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function defaultSave() {
    return { industry: { forage: 0, barn: 0, market: 0 }, stat: { decisions: 0, runs: 0 }, best: { novice: 0, normal: 0, veteran: 0, impossible: 0 }, endlessBest: Object.fromEntries(Object.keys(DIFFICULTIES).map(id => [id, { rounds: 0, horses: 0 }])), leaderboard: { nickname: DEFAULT_NICKNAME, entries: [] }, settings: { sound: true, difficulty: 'novice', musicVolume: 1, sfxVolume: 1 } };
  }
  function integer(value, max = Number.MAX_SAFE_INTEGER) {
    return typeof value === 'number' && Number.isFinite(value) ? clamp(Math.floor(value), 0, max) : 0;
  }
  function sanitizeNickname(value) {
    if (typeof value !== 'string') return DEFAULT_NICKNAME;
    const cleaned = Array.from(value.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim()).slice(0, 8).join('');
    return cleaned || DEFAULT_NICKNAME;
  }
  function leaderboardEntries(raw) {
    const list = [];
    const seen = new Set();
    if (!Array.isArray(raw)) return list;
    for (const item of raw.slice(0, LEADERBOARD_LIMIT)) {
      if (!item || typeof item !== 'object' || !validDifficulty(item.difficulty)) continue;
      const score = integer(item.score, 9999999);
      const id = typeof item.id === 'string' && /^[a-z0-9]{1,24}$/i.test(item.id) ? item.id : '';
      if (!id || !score || seen.has(id)) continue;
      seen.add(id);
      list.push({
        id,
        name: sanitizeNickname(item.name),
        score,
        stars: integer(item.stars, 5),
        difficulty: item.difficulty,
        date: typeof item.date === 'string' ? item.date.slice(0, 10) : ''
      });
    }
    return list.sort((a, b) => b.score - a.score || b.stars - a.stars);
  }
  function loadSave() {
    const data = defaultSave();
    try {
      const raw = root.localStorage && root.localStorage.getItem(SAVE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return data;
      for (const id of Object.keys(data.industry)) data.industry[id] = integer(parsed.industry?.[id], INDUSTRY_CAP);
      for (const id of Object.keys(data.stat)) data.stat[id] = integer(parsed.stat?.[id]);
      for (const id of Object.keys(data.best)) data.best[id] = integer(parsed.best?.[id]);
      for (const id of Object.keys(data.endlessBest)) data.endlessBest[id] = { rounds: integer(parsed.endlessBest?.[id]?.rounds), horses: integer(parsed.endlessBest?.[id]?.horses, HORSE_COUNT) };
      data.leaderboard.nickname = sanitizeNickname(parsed.leaderboard?.nickname);
      data.leaderboard.entries = leaderboardEntries(parsed.leaderboard?.entries);
      if (typeof parsed.settings?.sound === 'boolean') data.settings.sound = parsed.settings.sound;
      for (const key of ['musicVolume', 'sfxVolume']) {
        if (typeof parsed.settings?.[key] === 'number' && Number.isFinite(parsed.settings[key])) data.settings[key] = clamp(parsed.settings[key], 0, 1);
      }
      if (validDifficulty(parsed.settings?.difficulty)) data.settings.difficulty = parsed.settings.difficulty;
    } catch (_) { return defaultSave(); }
    return data;
  }
  let persistent = loadSave();
  function writeSave() {
    try { if (root.localStorage) { root.localStorage.setItem(SAVE_KEY, JSON.stringify(persistent)); return true; } } catch (_) { /* Storage is optional. */ }
    return false;
  }
  function getIndustry() { return { ...persistent.industry }; }
  function getSettings() { return { ...persistent.settings }; }
  function bumpIndustry(id) {
    if (!Object.prototype.hasOwnProperty.call(persistent.industry, id)) return false;
    persistent.industry[id] = Math.min(INDUSTRY_CAP, persistent.industry[id] + 1);
    writeSave(); return true;
  }
  function setSetting(key, value) {
    if (key === 'sound' && typeof value === 'boolean'
      || key === 'difficulty' && validDifficulty(value)
      || ['musicVolume', 'sfxVolume'].includes(key) && typeof value === 'number' && Number.isFinite(value)) {
      persistent.settings[key] = key === 'musicVolume' || key === 'sfxVolume' ? clamp(value, 0, 1) : value;
      writeSave(); return true;
    }
    return false;
  }
  function clearSave() {
    persistent = defaultSave();
    try { if (root.localStorage) root.localStorage.removeItem(SAVE_KEY); } catch (_) { /* Keep the reset in memory. */ }
  }
  function recordScore(difficulty, score) {
    if (!validDifficulty(difficulty) || typeof score !== 'number' || !Number.isFinite(score)) return { best: 0, isNew: false };
    const previous = persistent.best[difficulty] || 0;
    const isNew = score > previous;
    if (isNew) { persistent.best[difficulty] = integer(score); writeSave(); }
    return { best: persistent.best[difficulty], isNew };
  }
  function todayLabel() {
    const date = new Date();
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function addLeaderboardEntry(entry) {
    const record = entry && typeof entry === 'object' ? entry : {};
    const score = integer(record.score, 9999999);
    if (!validDifficulty(record.difficulty) || score <= 0) return '';
    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: sanitizeNickname(record.name ?? persistent.leaderboard.nickname),
      score,
      stars: integer(record.stars, 5),
      difficulty: record.difficulty,
      date: typeof record.date === 'string' && record.date ? record.date.slice(0, 10) : todayLabel()
    };
    persistent.leaderboard.nickname = item.name;
    persistent.leaderboard.entries.push(item);
    persistent.leaderboard.entries.sort((a, b) => b.score - a.score || b.stars - a.stars);
    persistent.leaderboard.entries = persistent.leaderboard.entries.slice(0, LEADERBOARD_LIMIT);
    writeSave();
    return item.id;
  }
  function getLeaderboard() {
    return persistent.leaderboard.entries.map(entry => ({ ...entry }));
  }
  function getLeaderboardRank(id) {
    const index = persistent.leaderboard.entries.findIndex(entry => entry.id === id);
    return index < 0 ? null : { rank: index + 1, total: persistent.leaderboard.entries.length };
  }
  function getNickname() {
    return persistent.leaderboard.nickname;
  }
  function renameLeaderboardEntry(id, name) {
    const entry = persistent.leaderboard.entries.find(item => item.id === id);
    if (!entry) return { ok: false, reason: '没有找到本次成绩，可能已超出本机榜单容量。' };
    const cleaned = sanitizeNickname(name);
    entry.name = cleaned;
    persistent.leaderboard.nickname = cleaned;
    writeSave();
    return { ok: true, name: cleaned };
  }
  const save = { loadSave, writeSave, getIndustry, bumpIndustry, clearSave, getSettings, setSetting, getBest: () => ({ ...persistent.best }), getEndlessBest: () => Object.fromEntries(Object.entries(persistent.endlessBest).map(([id, record]) => [id, { ...record }])), recordScore, getLeaderboard, getLeaderboardRank, getNickname, renameLeaderboardEntry, getStats: () => ({ ...persistent.stat }) };

  function unlock(s, ids) {
    for (const id of ids) if (!s.unlocked.includes(id)) s.unlocked.push(id);
  }

  function createGame() {
    return {
      state: 'title',
      mode: 'story',
      endlessRound: 1,
      endlessRounds: 0,
      endlessCleared: false,
      endlessNewBest: false,
      endlessShield: false,
      courage: 3,
      endReason: '',
      difficulty: getSettings().difficulty,
      tutorialDone: false,
      progressMilestones: Array(HORSE_COUNT).fill(0),
      completed: Array(HORSE_COUNT).fill(false),
      cowries: 0,
      upgrades: { rope: false, bell: false, gold: false, sword: false, fish: false, token: false },
      unlocked: ['container', 'cowrie'],
      retryProgress: Array(HORSE_COUNT).fill(0),
      selectedHorse: 0,
      activeHorse: null,
      tigerUsed: false,
      tigerChapterUsed: false,
      finalTigerUsed: false,
      finalTigerFinished: false,
      paused: false,
      notice: '',
      taming: null,
      tiger: null,
      victoryElapsed: 0,
      scoreParts: { taming: 0, combat: 0 },
      horseScores: Array(HORSE_COUNT).fill(0),
      timeoutCount: Array(HORSE_COUNT).fill(0),
      timeouts: 0,
      tigerWins: 0,
      tigerLosses: 0,
      lastHorseScore: 0,
      lastHorseGrade: 'C',
      lastCombatScore: 0,
      finalScore: 0,
      finalStars: 0,
      bestScore: 0,
      newBest: false,
      leaderboardId: '',
      pendingErrands: 0,
      runBarn: 0,
      forageBuff: 1,
      victoryPending: false
    };
  }

  function validDifficulty(id) {
    return Object.prototype.hasOwnProperty.call(DIFFICULTIES, id);
  }

  function profile(s) {
    const base = DIFFICULTIES[validDifficulty(s.difficulty) ? s.difficulty : 'novice'];
    if (s.mode !== 'endless') return base;
    const pressure = Math.min(30, Math.max(0, s.endlessRound - 1));
    return { ...base,
      widths: base.widths.map(w => Math.max(.055, w * Math.pow(.94, pressure))),
      periods: base.periods.map(p => p / Math.min(1.75, 1 + pressure * .04)),
      amplitudes: base.amplitudes.map(a => Math.min(.29, a + pressure * .003)),
      duration: Math.max(10, base.duration - pressure * .06),
      decay: Math.min(.24, base.decay + pressure * .002)
    };
  }

  function getReward(s) {
    return Math.floor(profile(s).reward * (s.upgrades.gold ? 1.25 : 1)) + (s.upgrades.token ? 10 : 0) + (s.mode === 'endless' ? 0 : 2 * persistent.industry.barn + 2 * s.runBarn);
  }

  function gradeFor(score) {
    for (const [min, id, label] of SCORE.grades) if (score >= min) return { id, label };
    return { id: 'C', label: '再接再厉' };
  }

  function scoreBreakdown(s) {
    const explore = Math.max(0, s.unlocked.length - SCORE.exploreStart) * SCORE.explorePer;
    const taming = s.scoreParts.taming;
    const combat = s.scoreParts.combat;
    const multiplier = SCORE.multiplier[s.difficulty] || 1;
    return { taming, combat, explore, raw: taming + combat + explore, multiplier, total: Math.round((taming + combat + explore) * multiplier) };
  }

  function averageHorseScore(s) {
    const scores = s.horseScores.filter((_, index) => s.completed[index]);
    return scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  }

  // 通关星级看本局过程：超时少、双虎全胜才能拿满五星。
  function runStars(s) {
    if (!s.completed.every(Boolean)) return 0;
    if (s.timeouts === 0 && s.tigerLosses === 0) return 5;
    if (s.timeouts <= 2 && s.tigerLosses === 0) return 4;
    if (s.timeouts <= 4 && s.tigerLosses <= 1) return 3;
    return 2;
  }

  function setDifficulty(s, id) {
    if (s.state !== 'title' || !validDifficulty(id)) return false;
    s.difficulty = id;
    setSetting('difficulty', id);
    return true;
  }

  function setMode(s, mode) {
    if (s.state !== 'title' || !['story', 'endless'].includes(mode)) return false;
    s.mode = mode; return true;
  }

  function startRun(s, id, mode = s.mode) {
    const selected = validDifficulty(id) ? id : validDifficulty(s.difficulty) ? s.difficulty : 'novice';
    Object.assign(s, createGame());
    s.difficulty = selected;
    s.mode = mode === 'endless' ? 'endless' : 'story';
    s.state = 'map';
    s.cowries = s.mode === 'endless' ? 0 : 6 * persistent.industry.market;
    persistent.stat.runs = integer(persistent.stat.runs + 1);
    setSetting('difficulty', selected);
    s.notice = '选择一组牵马，按住上升，松开下降。';
  }

  function getEndlessRecord(s) {
    return { rounds: s.endlessRounds, horses: s.endlessCleared ? 0 : s.completed.filter(Boolean).length };
  }

  function recordEndless(s) {
    if (s.mode !== 'endless') return;
    const current = getEndlessRecord(s), best = persistent.endlessBest[s.difficulty];
    if (current.rounds > best.rounds || current.rounds === best.rounds && current.horses > best.horses) {
      persistent.endlessBest[s.difficulty] = current;
      s.endlessNewBest = true; writeSave();
    }
  }

  function endEndless(s, reason = 'retired') {
    if (s.mode !== 'endless' || ['title', 'endless-result'].includes(s.state)) return false;
    recordEndless(s); s.endReason = reason === 'courage' ? 'courage' : 'retired';
    s.state = 'endless-result'; s.activeHorse = null;
    s.finalScore = scoreBreakdown(s).total;
    return true;
  }

  function continueEndless(s) {
    if (s.mode !== 'endless' || s.state !== 'endless-break' || !s.endlessCleared || s.courage <= 0) return false;
    s.endlessRound++; s.endlessCleared = false;
    Object.assign(s, { state: 'map', completed: Array(HORSE_COUNT).fill(false), retryProgress: Array(HORSE_COUNT).fill(0), progressMilestones: Array(HORSE_COUNT).fill(0), horseScores: Array(HORSE_COUNT).fill(0), timeoutCount: Array(HORSE_COUNT).fill(0), selectedHorse: 0, activeHorse: null, taming: null, tiger: null, tigerUsed: false, tigerChapterUsed: false, finalTigerUsed: false, finalTigerFinished: false, victoryPending: false, pendingErrands: 0, runBarn: 0 });
    s.notice = '第' + s.endlessRound + '轮开始！海贝、道具与图鉴已保留。';
    return true;
  }

  function retryEndlessBoss(s) {
    if (s.mode !== 'endless' || s.state !== 'endless-retry' || s.courage <= 0) return false;
    s.finalTigerFinished = false; startTiger(s, HORSE_COUNT - 1, 'finale'); return true;
  }

  function buySupply(s, id) {
    if (s.mode !== 'endless' || s.state !== 'map' || s.paused) return { ok: false, reason: '请在无尽模式地图准备补给。' };
    const price = id === 'forage' ? 25 : id === 'shield' ? 35 : 0;
    if (!price) return { ok: false, reason: '没有这件补给。' };
    if (id === 'forage' && s.forageBuff > 1 || id === 'shield' && s.endlessShield) return { ok: false, reason: '已备好一份，请使用后再买。' };
    if (s.cowries < price) return { ok: false, reason: '海贝不足，先完成训练吧。' };
    s.cowries -= price;
    if (id === 'forage') s.forageBuff = 1.15; else s.endlessShield = true;
    return { ok: true, reason: id === 'forage' ? '草料已备好：下次训练绿区扩大15%。' : '护符已备好：下一场虎战抵挡一次伤害。' };
  }

  function startHorse(s, index) {
    if (s.paused || s.state !== 'map' || s.victoryPending) return false;
    if (!Number.isInteger(index) || index < 0 || index >= HORSE_COUNT) return false;
    if (s.completed[index]) {
      s.notice = '这组人马已经归位。';
      return false;
    }
    s.state = 'taming';
    s.selectedHorse = index;
    s.activeHorse = index;
    s.taming = {
      position: 0.5,
      progress: s.retryProgress[index],
      peakProgress: s.retryProgress[index],
      elapsed: 0,
      duration: profile(s).duration,
      // 只统计正式挑战：练习段不计入评分。
      playTime: 0,
      insideTime: 0,
      phase: 'playing',
      tutorial: s.difficulty === 'novice' && !s.tutorialDone ? { step: 'hold', held: 0 } : null,
      resultTime: 0
    };
    s.taming.zoneBuff = s.forageBuff;
    s.forageBuff = 1;
    s.retryProgress[index] = 0;
    s.notice = '';
    return true;
  }

  function skipTutorial(s) {
    if (s.paused || s.state !== 'taming' || !s.taming.tutorial) return false;
    s.taming.tutorial = null;
    s.taming.position = getZone(s, s.activeHorse, 0).center;
    s.tutorialDone = true;
    return true;
  }

  function buy(s, id) {
    let reason;
    const item = Object.prototype.hasOwnProperty.call(SHOP, id) ? SHOP[id] : null;
    if (s.paused || s.state !== 'map') reason = '请回到环盖商店购买。';
    else if (!item) reason = '没有这件商品。';
    else if (s.upgrades[id]) reason = '已经拥有，无需重复购买。';
    else if (s.cowries < item.price) reason = '海贝不足，先驯服一匹马吧。';
    else {
      s.cowries -= item.price;
      s.upgrades[id] = true;
      unlock(s, [item.unlock]);
      reason = item.name + '已拥有，效果立即生效。';
      s.notice = reason;
      return { ok: true, reason };
    }
    s.notice = reason;
    return { ok: false, reason };
  }

  function getZone(s, index, time = 0) {
    const p = profile(s);
    const tier = index === 0 ? 0 : index <= 3 ? 1 : 2;
    const baseWidth = p.widths[tier];
    const width = Math.min(1, baseWidth * (s.upgrades.rope ? 1.25 : 1) * (s.mode === 'endless' ? 1 : 1 + 0.015 * persistent.industry.forage) * (s.taming && s.state === 'taming' ? s.taming.zoneBuff : 1));
    const amplitude = p.amplitudes[tier];
    const period = p.periods[tier];
    const driftSpeed = s.upgrades.bell ? 0.8 : 1;
    const center = clamp(0.5 + amplitude * Math.sin(time * driftSpeed * Math.PI * 2 / period), width / 2, 1 - width / 2);
    return { center, width, min: center - width / 2, max: center + width / 2 };
  }

  // Scene and instrument share the same rule data. Pose is also an early cue:
  // continuing the current input for 0.18s previews an impending boundary exit.
  function getTamingCue(s, holding = false) {
    if (s.state !== 'taming' || !s.taming) return null;
    const t = s.taming, p = profile(s);
    const zone = getZone(s, s.activeHorse, t.elapsed);
    const future = getZone(s, s.activeHorse, t.elapsed + 0.18);
    const inside = t.position >= zone.min && t.position <= zone.max;
    const projected = clamp(t.position + (holding ? p.upSpeed : -p.downSpeed) * 0.18, 0, 1);
    const success = t.phase === 'success';
    const target = getZone(s, s.activeHorse, t.elapsed + 0.025).center;
    const action = success ? 'none' : t.tutorial && t.tutorial.step !== 'steady' ? t.tutorial.step === 'hold' ? 'hold' : 'release' : t.position < target ? 'hold' : 'release';
    const warning = !success && inside && (projected < future.min || projected > future.max);
    const posture = success ? 'settled' : !inside ? t.position > zone.max ? 'rear' : 'reach' : action === 'release' ? 'lift' : 'lower';
    const label = success ? '人马归位 · 缰绳放缓' : action === 'hold' ? '马首下探 · 按住收缰' : '马首抬高 · 松缰';
    return {
      zone, inside, action, posture, warning, label, holding: !!holding,
      balance: clamp((t.position - zone.center) / (zone.width / 2), -1.6, 1.6),
      drift: (future.center - zone.center) / 0.18,
      progress: t.progress,
      feedback: success ? '人马归位' : !inside ? action === 'release' ? '缰绳过紧 · 扬蹄挣扎' : '缰绳过松 · 低首前探' : warning ? '即将越界 · 顺势调整' : '步态平稳 · 正在建立默契'
    };
  }

  function getDodgeCue(s) {
    if (s.state !== 'tiger' || !s.tiger) return null;
    const t = s.tiger;
    const target = t.strikes[t.activeStrike];
    return { ready: t.phase === 'ring' && !target.resolved && t.radius >= COMBAT.minRadius - EPSILON && t.radius <= COMBAT.maxRadius + EPSILON, round: t.round, side: target.side, nextSide: t.strikes.find(a => !a.resolved && a !== target)?.side || 'left', order: target.order, pending: t.strikes.filter(a => !a.resolved).length, total: t.strikes.length };
  }

  function returnToMap(s, index) {
    s.state = 'map';
    s.selectedHorse = index;
    s.activeHorse = null;
  }

  function finishHorse(s) {
    const index = s.activeHorse;
    // The phase guard also prevents a held input or subsequent frame paying twice.
    if (s.completed[index] || s.taming.phase !== 'playing') return;
    const t = s.taming;
    const timeRatio = clamp((t.duration - t.elapsed) / t.duration, 0, 1);
    const steady = t.playTime > 0 ? clamp(t.insideTime / t.playTime, 0, 1) : 0;
    const retryPenalty = Math.min(SCORE.retryPenaltyCap, (s.timeoutCount[index] || 0) * SCORE.retryPenalty);
    const horseScore = clamp(Math.round(SCORE.horseBase + SCORE.horseTime * timeRatio + SCORE.horseSteady * steady - retryPenalty), 0, 100);
    s.horseScores[index] = horseScore;
    s.scoreParts.taming += horseScore;
    s.lastHorseScore = horseScore;
    s.lastHorseGrade = gradeFor(horseScore).id;
    s.completed[index] = true;
    s.retryProgress[index] = 0;
    const reward = getReward(s);
    s.cowries += reward;
    s.taming.progress = 1;
    s.taming.phase = 'success';
    s.taming.resultTime = 0;
    s.notice = '人马归位 +' + reward + ' 海贝 · 本匹评分 ' + horseScore + '（' + s.lastHorseGrade + '）';

    const count = s.completed.filter(Boolean).length;
    const milestones = { 1: ['bell'], 2: ['sword'], 3: ['handge'], 4: ['cloud'], 6: ['buckle'], 7: ['riders', 'textile', 'cowtiger'] };
    unlock(s, milestones[count] || []);
    if (count <= 6 && s.mode !== 'endless') s.pendingErrands = Math.min(6, s.pendingErrands + 1);
    recordEndless(s);
    if (count === HORSE_COUNT) {
      s.victoryPending = true;
    }
  }

  function enterVictory(s) {
    if (s.mode === 'endless') return false;
    if (!['map', 'taming'].includes(s.state) || s.pendingErrands > 0 || !s.completed.every(Boolean) || !s.finalTigerFinished) return false;
    s.state = 'victory'; s.activeHorse = null; s.victoryElapsed = 0;
    s.victoryPending = false;
    s.finalScore = scoreBreakdown(s).total;
    s.finalStars = runStars(s);
    const record = recordScore(s.difficulty, s.finalScore);
    s.bestScore = record.best;
    s.newBest = record.isNew;
    s.leaderboardId = addLeaderboardEntry({ name: persistent.leaderboard.nickname, score: s.finalScore, stars: s.finalStars, difficulty: s.difficulty });
    s.notice = '七组人马归位，本局评分 ' + s.finalScore + (s.newBest ? ' · 新纪录！' : '。');
    return true;
  }
  function errandOptions(s) {
    return ERRANDS.map(item => {
      const level = persistent.industry[item.id], nextLevel = Math.min(INDUSTRY_CAP, level + 1);
      const value = item.id === 'forage' ? +(nextLevel * 1.5).toFixed(1) : item.id === 'barn' ? nextLevel * 2 : nextLevel * 6;
      return { ...item, level, nextLevel, full: level === INDUSTRY_CAP, preview: item.id === 'forage' ? `绿区 +${value}%` : item.id === 'barn' ? `每匹 +${value} 海贝` : `开局 ${value} 海贝` };
    });
  }
  function resolveErrand(s, id) {
    if (s.mode === 'endless' || s.state !== 'map' || s.pendingErrands <= 0 || !ERRANDS.some(item => item.id === id)) return { ok: false, text: '请在地图办理待办差事。' };
    let text;
    if (id === 'forage') {
      text = s.forageBuff >= 1.25 ? '草料已备足，下次训练绿区 ×1.25。' : '草料备好了，下次训练绿区更宽。';
      s.forageBuff = Math.min(1.25, s.forageBuff * 1.12);
    } else if (id === 'barn') { s.runBarn++; text = '马厩修好了，本局后续每匹 +2 海贝。'; }
    else { s.cowries += 10; text = '赶集归来，立即 +10 海贝。'; }
    s.pendingErrands--;
    persistent.stat.decisions = integer(persistent.stat.decisions + 1);
    bumpIndustry(id);
    return { ok: true, text };
  }

  function horseTimeout(s) {
    const index = s.activeHorse;
    s.timeoutCount[index] += 1;
    s.timeouts += 1;
    const retained = Math.min(0.5, s.taming.peakProgress * 0.5);
    s.retryProgress[index] = retained;
    // 超时不再回地图，直接引来双虎；战后仍落回该组，可立即重试。
    startTiger(s, index, 'timeout');
    // startTiger 会覆盖 notice，因此进度提示必须写在它之后。
    s.notice = '本次超时，惊动了器耳双虎；战后回到这里可立即重试。保留最高进度的一半（' + Math.round(retained * 100) + '%），海贝不扣除。';
  }

  function startTiger(s, nextHorse, trigger = 'chapter') {
    const playerHp = COMBAT.playerHp + (s.upgrades.fish ? 25 : 0);
    const enemyHp = COMBAT.hp + (s.mode === 'endless' ? Math.min(180, (s.endlessRound - 1) * 10) : 0);
    s.tigerUsed = true;
    if (trigger === 'chapter') s.tigerChapterUsed = true;
    if (trigger === 'finale') s.finalTigerUsed = true;
    s.state = 'tiger';
    s.activeHorse = null;
    s.tiger = {
      nextHorse, trigger,
      phase: 'intro', elapsed: 0, radius: 180, result: null,
      hp: enemyHp, maxHp: enemyHp, playerHp, playerMaxHp: playerHp,
      attackDamage: COMBAT.attackDamage + (s.upgrades.sword ? 4 : 0),
      attackCooldown: 0, dodged: false, dodges: 0, feedback: '等双虎上前，再伺机出击。',
      hitFlash: 0, playerHitFlash: 0, attacks: 0, round: 0,
      activeTiger: 0, hitSide: 'left',
      activeStrike: 0, wave: 0, strikeSerial: 0,
      combatDifficulty: (trigger === 'finale' || s.mode === 'endless' && s.endlessRound >= 3) && s.difficulty !== 'impossible' ? 'veteran' : s.difficulty,
      pressure: s.mode === 'endless' ? 1 + Math.min(12, s.endlessRound - 1) * .025 : 1,
      shield: s.mode === 'endless' && s.endlessShield,
      fighters: [
        { side: 'left', name: '左虎', phase: 'windup', charge: 0, radius: 180, elapsed: 0, duration: COMBAT.ring, hitFlash: 0, lunge: 0 },
        { side: 'right', name: '右虎', phase: 'waiting', charge: 0, radius: 180, elapsed: 0, duration: COMBAT.rightRing, hitFlash: 0, lunge: 0 }
      ]
    };
    launchVolley(s.tiger);
    syncTiger(s.tiger);
    if (s.mode === 'endless') s.endlessShield = false;
    s.notice = trigger === 'finale' ? '七马归位！迎接四道攻击的双虎终战，战后开启文物档案。' : trigger === 'chapter' ? '四组归位，器耳双虎苏醒！' : '驯马超时，惊动了器耳双虎！';
    unlock(s, ['armor', 'fork']);
  }

  function launchVolley(tiger) {
    const high = ['veteran', 'impossible'].includes(tiger.combatDifficulty);
    const spacing = Math.max(.9, { novice: 2.5, normal: 2, veteran: 1.5, impossible: 1.2 }[tiger.combatDifficulty] / tiger.pressure);
    tiger.wave++;
    tiger.strikes = Array.from({ length: high ? 4 : 2 }, (_, index) => ({
      id: ++tiger.strikeSerial, order: index + 1, side: index % 2 ? 'right' : 'left',
      duration: COMBAT.ring + index * spacing, elapsed: 0, radius: 180, resolved: false, outcome: null
    }));
    tiger.activeStrike = 0; tiger.activeTiger = 0; tiger.round = tiger.strikes[0].id;
    tiger.radius = 180;
  }

  function syncTiger(tiger) {
    const next = tiger.strikes.find(a => !a.resolved);
    if (next && tiger.phase === 'ring') {
      tiger.activeStrike = next.order - 1;
      tiger.activeTiger = next.side === 'left' ? 0 : 1;
      tiger.round = next.id; tiger.radius = next.radius;
    }
    for (const fighter of tiger.fighters) {
      const own = tiger.strikes.filter(a => !a.resolved && a.side === fighter.side);
      fighter.pending = own.length;
      fighter.phase = tiger.phase === 'result' ? 'done' : tiger.phase === 'intro' ? 'windup' : own.length ? 'strike' : 'recover';
      if (own.length) {
        fighter.radius = own[0].radius; fighter.elapsed = own[0].elapsed;
        fighter.charge = (180 - own[0].radius) / 140;
      }
    }
  }

  function advanceStrikes(tiger, dt) {
    // Every unresolved attack advances, including while another attack is being
    // dodged. The last portion keeps the original, readable 0.31s dodge window.
    const finalApproach = COMBAT.ring * 32 / 140;
    for (const strike of tiger.strikes) {
      if (strike.resolved) continue;
      strike.elapsed = Math.min(strike.duration, strike.elapsed + dt);
      const remaining = strike.duration - strike.elapsed;
      strike.radius = remaining > finalApproach
        ? 180 - 108 * strike.elapsed / (strike.duration - finalApproach)
        : 40 + 140 * remaining / COMBAT.ring;
    }
  }

  function resolveTiger(s, success) {
    s.tiger.phase = 'result';
    s.tiger.elapsed = 0;
    s.tiger.result = success ? 'success' : 'failure';
    for (const strike of s.tiger.strikes) { if (!strike.resolved) strike.outcome = 'cancelled'; strike.resolved = true; }
    for (const fighter of s.tiger.fighters) fighter.phase = 'done';
    if (s.tiger.trigger === 'finale') s.finalTigerFinished = true;
    if (!success && s.mode !== 'endless' && s.difficulty !== 'novice') s.cowries = Math.floor(s.cowries * 70 / 100);
    if (success) s.tigerWins += 1; else s.tigerLosses += 1;
    // 超时引来的双虎战给较低分数，避免靠反复超时刷战斗分。
    const timeoutBattle = s.tiger.trigger === 'timeout';
    const winPoints = timeoutBattle ? SCORE.timeoutWin : SCORE.combatWin;
    const dodgeCap = timeoutBattle ? SCORE.timeoutDodgeCap : SCORE.combatDodgeCap;
    const losePoints = timeoutBattle ? SCORE.timeoutLose : SCORE.combatLose;
    const combatScore = success ? winPoints + Math.min(dodgeCap, (s.tiger.dodges || 0) * SCORE.combatDodge) : losePoints;
    s.scoreParts.combat += combatScore;
    s.lastCombatScore = combatScore;
    const back = s.tiger.trigger === 'finale' ? '七马终战完成，准备开启文物档案。' : s.tiger.trigger === 'chapter' ? '继续驯服剩余马匹。' : '回地图重试刚才超时的那组。';
    s.notice = success ? '双虎退去！战斗评分 +' + combatScore + '。' + back : s.difficulty === 'novice' ? '勇敢尝试，真棒！新手不扣海贝，战斗评分 +' + combatScore + '；' + back : '试炼结束，损失30%现有海贝；战斗评分 +' + combatScore + '，已归位人马保留，' + back;
    if (s.mode === 'endless') {
      if (!success) s.courage = Math.max(0, s.courage - 1);
      if (success && s.tiger.trigger === 'finale') { s.endlessRounds = s.endlessRound; s.endlessCleared = true; }
      recordEndless(s);
      s.notice = success ? s.endlessCleared ? '第' + s.endlessRound + '轮守关成功！可以继续下一轮。' : '双虎退去，回到原马继续挑战。' : '勇气 -1，剩余' + s.courage + '/3。' + (s.courage ? '海贝与道具保留，可再次挑战。' : '本次无尽挑战结束。');
    }
  }

  function attack(s) {
    if (s.paused || s.state !== 'tiger' || !['ring', 'recover'].includes(s.tiger.phase) || s.tiger.attackCooldown > EPSILON) return false;
    const tiger = s.tiger;
    tiger.hp = Math.max(0, tiger.hp - tiger.attackDamage);
    tiger.attackCooldown = COMBAT.attackCooldown;
    tiger.attacks++;
    tiger.hitFlash = 0.18;
    tiger.hitSide = tiger.fighters[tiger.activeTiger].side;
    tiger.fighters[tiger.activeTiger].hitFlash = 0.18;
    tiger.feedback = '命中' + tiger.fighters[tiger.activeTiger].name + ' −' + tiger.attackDamage;
    if (tiger.hp === 0) resolveTiger(s, true);
    return true;
  }

  function resolveRound(s, success) {
    const tiger = s.tiger;
    const fighter = tiger.fighters[tiger.activeTiger];
    const strike = tiger.strikes[tiger.activeStrike];
    strike.resolved = true; strike.outcome = success ? 'dodged' : 'hit';
    fighter.lunge = 0.28;
    tiger.dodged = success;
    if (success) {
      tiger.dodges += 1;
      tiger.hp = Math.max(0, tiger.hp - COMBAT.counterDamage);
      tiger.hitFlash = 0.22;
      tiger.hitSide = fighter.side; fighter.hitFlash = 0.22;
      tiger.feedback = '躲过' + fighter.name + '！反击 −' + COMBAT.counterDamage;
    } else {
      const damage = DIFFICULTIES[tiger.combatDifficulty].tigerDamage;
      const blocked = tiger.shield;
      tiger.shield = false;
      if (!blocked) { tiger.playerHp = Math.max(0, tiger.playerHp - damage); tiger.playerHitFlash = 0.25; }
      tiger.feedback = blocked ? '护符抵挡了本次伤害！' : fighter.name + '第' + strike.order + '击，受到 ' + damage + ' 点伤害';
    }
    if (tiger.hp === 0) resolveTiger(s, true);
    else if (tiger.playerHp === 0) resolveTiger(s, false);
    else {
      tiger.phase = 'recover';
      tiger.elapsed = 0;
      syncTiger(tiger);
    }
  }

  function dodge(s) {
    if (s.paused || s.state !== 'tiger' || s.tiger.phase !== 'ring') return false;
    const success = getDodgeCue(s).ready;
    resolveRound(s, success);
    return true;
  }

  function step(s, dt, input = {}) {
    if (s.paused || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);

    if (s.state === 'taming') {
      const taming = s.taming;
      if (taming.phase === 'success') {
        taming.resultTime += dt;
        if (taming.resultTime + EPSILON >= 0.55) {
          const previous = s.activeHorse;
          let next = previous;
          for (let offset = 1; offset <= HORSE_COUNT; offset++) {
            const index = (previous + offset) % HORSE_COUNT;
            if (!s.completed[index]) { next = index; break; }
          }
          if (s.mode !== 'endless' && s.completed.filter(Boolean).length === 4 && !s.tigerChapterUsed) {
            startTiger(s, next, 'chapter');
            return;
          }
          if (s.completed.every(Boolean) && !s.finalTigerUsed) {
            startTiger(s, previous, 'finale');
            return;
          }
          returnToMap(s, next);
          if (s.completed.filter(Boolean).length === 1 && !s.upgrades.rope) s.notice = '已有' + s.cowries + '海贝，可选择中心商店购买长缰绳。';
        }
        return;
      }

      const p = profile(s);
      taming.position = clamp(taming.position + (input.hold ? p.upSpeed : -p.downSpeed) * dt, 0, 1);
      if (taming.tutorial) {
        const lesson = taming.tutorial;
        const zone = getZone(s, s.activeHorse, 0);
        const correct = lesson.step === 'steady' ? taming.position >= zone.min && taming.position <= zone.max : lesson.step === 'hold' ? !!input.hold : !input.hold;
        lesson.held = correct ? lesson.held + dt : 0;
        if (lesson.held + EPSILON >= (lesson.step === 'steady' ? 1.2 : 0.3)) {
          if (lesson.step === 'steady') skipTutorial(s);
          else { lesson.step = lesson.step === 'hold' ? 'release' : 'steady'; lesson.held = 0; }
        }
        return;
      }
      taming.elapsed = Math.min(taming.duration, taming.elapsed + dt);
      const zone = getZone(s, s.activeHorse, taming.elapsed);
      const inside = taming.position >= zone.min && taming.position <= zone.max;
      taming.playTime += dt;
      if (inside) taming.insideTime += dt;
      taming.progress = clamp(taming.progress + (inside ? p.gain : -p.decay) * dt, 0, 1);
      taming.peakProgress = Math.max(taming.peakProgress, taming.progress);
      s.progressMilestones[s.activeHorse] = Math.max(s.progressMilestones[s.activeHorse], Math.min(3, Math.floor((taming.progress + EPSILON) * 4)));
      if (taming.progress + EPSILON >= 1) finishHorse(s);
      else if (taming.elapsed + EPSILON >= taming.duration) horseTimeout(s);
      return;
    }

    if (s.state === 'tiger') {
      const tiger = s.tiger;
      tiger.attackCooldown = Math.max(0, tiger.attackCooldown - dt);
      tiger.hitFlash = Math.max(0, tiger.hitFlash - dt);
      tiger.playerHitFlash = Math.max(0, tiger.playerHitFlash - dt);
      for (const fighter of tiger.fighters) {
        fighter.hitFlash = Math.max(0, fighter.hitFlash - dt);
        fighter.lunge = Math.max(0, fighter.lunge - dt);
      }
      if (input.attack && attack(s) && tiger.phase === 'result') return;
      if (input.dodge && tiger.phase === 'ring') {
        dodge(s);
        return;
      }
      tiger.elapsed += dt;
      if (tiger.phase === 'intro' && tiger.elapsed + EPSILON >= COMBAT.intro) {
        tiger.phase = 'ring';
        tiger.elapsed = 0;
        syncTiger(tiger);
        tiger.feedback = tiger.strikes.length + '道攻击同时逼近！按编号依次闪避。';
      } else if (['ring', 'recover'].includes(tiger.phase)) {
        advanceStrikes(tiger, dt);
        if (tiger.phase === 'recover') {
          const pending = tiger.strikes.some(a => !a.resolved);
          if (tiger.elapsed + EPSILON >= (pending ? COMBAT.recover : COMBAT.pairRecover)) {
            if (!pending) launchVolley(tiger);
            tiger.phase = 'ring'; tiger.elapsed = 0; tiger.dodged = false;
          }
        }
        syncTiger(tiger);
        const target = tiger.strikes[tiger.activeStrike];
        if (tiger.phase === 'ring' && target.elapsed + EPSILON >= target.duration) resolveRound(s, false);
      } else if (tiger.phase === 'result' && tiger.elapsed + EPSILON >= COMBAT.result) {
        if (s.mode === 'endless') {
          if (s.courage <= 0) endEndless(s, 'courage');
          else if (tiger.trigger === 'finale') s.state = tiger.result === 'success' ? 'endless-break' : 'endless-retry';
          else returnToMap(s, tiger.nextHorse);
          return;
        }
        returnToMap(s, tiger.nextHorse);
        if (tiger.trigger === 'finale' && !s.pendingErrands) enterVictory(s);
      }
      return;
    }

    if (s.state === 'victory') {
      s.victoryElapsed += dt;
      if (s.victoryElapsed + EPSILON >= 1) s.state = 'archive';
    }
  }

  const api = { DIFFICULTIES, COMBAT, SCORE, ERRANDS, INDUSTRY_CAP, SAVE_KEY, save, enterVictory, resolveErrand, errandOptions, createGame, setDifficulty, setMode, startRun, startHorse, skipTutorial, buy, buySupply, getProfile: profile, getEndlessRecord, continueEndless, retryEndlessBoss, endEndless, getReward, getZone, getTamingCue, getDodgeCue, gradeFor, scoreBreakdown, averageHorseScore, runStars, step, attack, dodge };
  root.GameCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
