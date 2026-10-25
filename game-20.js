(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const shortest = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
  function create() {
    return {
      angle: 0, mode: 'idle', selected: null, elapsed: 0, from: 0, delta: 0,
      enterMap() { this.mode = 'idle'; this.selected = null; },
      select(index, targetAngle) {
        if (!Number.isInteger(index) || index < 0 || index > 6 || !Number.isFinite(targetAngle)) return;
        this.selected = index; this.from = this.angle;
        this.delta = shortest(targetAngle - this.angle); this.elapsed = 0; this.mode = 'aligning';
      },
      freeze() { this.mode = 'locked'; },
      update(dt, { paused = false, reduced = false } = {}) {
        if (paused) return;
        const seconds = Number.isFinite(dt) ? Math.max(0, dt) : 0;
        if (this.mode === 'aligning') {
          this.elapsed = reduced ? 0.8 : Math.min(0.8, this.elapsed + seconds);
          const t = this.elapsed / 0.8;
          this.angle = this.from + this.delta * t * t * (3 - 2 * t);
          if (t >= 1) this.mode = 'locked';
        } else if (this.mode === 'idle' && !reduced) this.angle += seconds * TAU / 90;
      }
    };
  }
  const api = { create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BronzeMotion = api;
})(globalThis);
