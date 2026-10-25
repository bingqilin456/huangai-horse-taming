(function (root) {
  'use strict';
  const particles = [], waves = [], slashes = [], coins = [];
  const colors = { select: '#d6c28c', start: '#ddc997', success: '#b8e0aa', reward: '#ffe3a0', gift: '#bbecd9', coin: '#f0cf78', attack: '#ffe5b4', counter: '#b7efd4', hit: '#d38d70', fail: '#ba8d64', victory: '#f1dfad' };
  function emit(type, x = 425, y = 365, reduced = false) {
    const color = colors[type] || colors.select;
    waves.push({ x, y, age: 0, life: type === 'victory' ? 1.8 : .8, color, type, reduced });
    if (!reduced) {
      const celebration = type === 'reward' || type === 'gift' || type === 'victory';
      const palette = ['#ffe3a0', '#a5e2c5', '#f0ac99', '#bfc3ed'];
      const count = celebration ? 95 : type === 'success' ? 42 : type === 'select' ? 8 : 22;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2, speed = 30 + Math.random() * (type === 'victory' ? 210 : 110);
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * .65 - (celebration ? 100 : 24), age: 0, life: celebration ? 1.6 + Math.random() : .5 + Math.random() * .8, color: celebration ? palette[i % palette.length] : color, size: celebration ? 3 + Math.random() * 4 : 1 + Math.random() * 2, shape: celebration ? i % 3 === 0 ? 'star' : 'paper' : 'dust', spin: angle });
      }
      if (type === 'reward') for (let i = 0; i < 10; i++) coins.push({ x: x + (Math.random() - .5) * 100, y, age: -i * .055, life: 1.05 });
      if (type === 'attack' || type === 'counter') slashes.push({ age: 0, life: .28, color, counter: type === 'counter' });
    }
    if (particles.length > 220) particles.splice(0, particles.length - 220);
  }
  function draw(ctx, dt, time, options = {}) {
    ctx.save();
    if (!options.reduced && !options.paused) {
      // Quiet suspended gold dust; all motion is disabled by reduced-motion.
      for (let i = 0; i < 26; i++) {
        const x = (i * 193 + Math.sin(time * .13 + i) * 25 + 1280) % 1280;
        const y = (i * 97 - time * (4 + i % 4) + 7200) % 720;
        ctx.globalAlpha = .12 + (Math.sin(time * .7 + i) + 1) * .09;
        ctx.fillStyle = '#e7cf8c'; ctx.beginPath(); ctx.arc(x, y, i % 5 === 0 ? 1.6 : .8, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    const elapsed = options.paused ? 0 : dt;
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i]; w.age += elapsed; const p = w.age / w.life;
      if (p >= 1) { waves.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - p) * .65; ctx.strokeStyle = w.color; ctx.lineWidth = w.type === 'counter' ? 3 : 1.4;
      ctx.beginPath(); ctx.ellipse(w.x, w.y, w.reduced ? 50 : 18 + p * (w.type === 'victory' ? 300 : 110), w.reduced ? 18 : 8 + p * 40, -.08, 0, Math.PI * 2); ctx.stroke();
      if (w.type === 'counter') { ctx.font = '17px "Microsoft YaHei"'; ctx.textAlign = 'center'; ctx.fillStyle = w.color; ctx.fillText('完美闪避', w.x, w.y - 45 - p * 18); }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += elapsed;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * elapsed; p.y += p.vy * elapsed; p.vy += 45 * elapsed;
      ctx.globalAlpha = Math.min(1, (p.life - p.age) * 1.8); ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin + p.age * 3);
      if (p.shape === 'star') {
        ctx.beginPath(); for (let j = 0; j < 10; j++) { const angle = j * Math.PI / 5 - Math.PI / 2, r = j % 2 ? p.size * .45 : p.size; if (j) ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r); else ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r); } ctx.closePath(); ctx.fill();
      } else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.shape === 'paper' ? p.size * 1.8 : p.size);
      ctx.restore();
    }
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i]; c.age += elapsed; if (c.age < 0) continue;
      const p = c.age / c.life; if (p >= 1) { coins.splice(i, 1); continue; }
      const t = p * p * (3 - 2 * p), x = c.x + (640 - c.x) * t, y = c.y + (55 - c.y) * t - Math.sin(Math.PI * p) * 90;
      ctx.globalAlpha = Math.min(1, (1 - p) * 5); ctx.fillStyle = '#f9dc8e'; ctx.strokeStyle = '#9a6e32'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, 6 + Math.abs(Math.cos(p * 10)) * 3, 12, .4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 2, y - 7); ctx.lineTo(x - 2, y + 7); ctx.stroke();
    }
    for (let i = slashes.length - 1; i >= 0; i--) {
      const s = slashes[i]; s.age += elapsed; const p = s.age / s.life;
      if (p >= 1) { slashes.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - p) * .85; ctx.strokeStyle = s.color; ctx.lineWidth = 2 + (1 - p) * 3;
      [280, 580].forEach(x => { ctx.beginPath(); ctx.moveTo(x - 55, 300 + p * 20); ctx.quadraticCurveTo(x + 10, 330, x + 62, 410 - p * 20); ctx.stroke(); });
      if (s.counter) { ctx.globalAlpha *= .2; ctx.fillStyle = '#b7efd4'; ctx.beginPath(); ctx.ellipse(425 - p * 50, 378, 30 + p * 20, 65, -.2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  function clear() { particles.length = waves.length = slashes.length = coins.length = 0; }
  const api = { emit, draw, clear };
  root.GameEffects = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
