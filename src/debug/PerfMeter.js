function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function initialEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search || '');
    const q = params.get('perf');
    if (q === '1' || q === 'true') {
      localStorage.setItem('shadowdepths_perf', '1');
      return true;
    }
    if (q === '0' || q === 'false') {
      localStorage.setItem('shadowdepths_perf', '0');
      return false;
    }
    const stored = localStorage.getItem('shadowdepths_perf');
    if (stored === '1') return true;
    if (stored === '0') return false;
    return /^(127\.0\.0\.1|localhost)$/i.test(window.location.hostname || '');
  } catch {
    return false;
  }
}

class PerfMeter {
  constructor() {
    this.enabled = initialEnabled();
    this.frame = null;
    this.ema = {};
    this.max = {};
    this.lastSlow = null;
    this._lastLogAt = 0;
    if (typeof window !== 'undefined') {
      const api = {
        on: () => this.setEnabled(true),
        off: () => this.setEnabled(false),
        toggle: () => this.setEnabled(!this.enabled),
        snapshot: () => ({ ema: { ...this.ema }, max: { ...this.max }, lastSlow: this.lastSlow })
      };
      window.__shadowPerf = api;
      globalThis.__shadowPerf = api;
    }
  }

  setEnabled(value) {
    this.enabled = !!value;
    try { localStorage.setItem('shadowdepths_perf', this.enabled ? '1' : '0'); } catch { /* ignore */ }
    return this.enabled;
  }

  beginFrame() {
    if (!this.enabled) return;
    this.frame = { total: 0, sections: {}, startedAt: nowMs() };
  }

  measure(name, fn) {
    if (!this.enabled || typeof fn !== 'function') return fn();
    const t0 = nowMs();
    try {
      return fn();
    } finally {
      this.add(name, nowMs() - t0);
    }
  }

  add(name, ms) {
    if (!this.enabled || !this.frame) return;
    this.frame.sections[name] = (this.frame.sections[name] || 0) + ms;
  }

  endFrame(totalMs) {
    if (!this.enabled || !this.frame) return;
    const sections = this.frame.sections;
    sections.total = totalMs;
    for (const [k, v] of Object.entries(sections)) {
      this.ema[k] = this.ema[k] == null ? v : this.ema[k] + (v - this.ema[k]) * 0.18;
      this.max[k] = Math.max(this.max[k] || 0, v);
    }
    const aggregate = new Set(['tick', 'update', 'render']);
    const entries = Object.entries(sections);
    const leafEntries = entries.filter(([k]) => k !== 'total' && !aggregate.has(k));
    const worst = (leafEntries.length ? leafEntries : entries.filter(([k]) => k !== 'total'))
      .sort((a, b) => b[1] - a[1])[0] || ['none', 0];
    if (totalMs > 33 || worst[1] > 12) {
      this.lastSlow = {
        at: Math.round(nowMs()),
        total: Math.round(totalMs * 10) / 10,
        worst: worst[0],
        worstMs: Math.round(worst[1] * 10) / 10,
        sections: Object.fromEntries(Object.entries(sections)
          .map(([k, v]) => [k, Math.round(v * 10) / 10]))
      };
      if (nowMs() - this._lastLogAt > 1200) {
        this._lastLogAt = nowMs();
        console.info('[PERF]', this.lastSlow);
      }
    }
    this.frame = null;
  }

  render(ctx, layout) {
    if (!this.enabled || !ctx || !layout) return;
    const rows = ['total', 'render', 'world', 'floorLayer', 'tileCache', 'entities', 'particles', 'ui', 'enemyTurn', 'save']
      .filter((k) => this.ema[k] != null)
      .map((k) => `${k.padEnd(9)} ${this.ema[k].toFixed(1).padStart(5)} ms`);
    if (!rows.length) return;
    const w = 154;
    const h = 20 + rows.length * 13 + (this.lastSlow ? 16 : 0);
    const x = 6;
    const y = Math.max(6, (layout.hud || 0) + 6);
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = '#050308';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#d4ac6c';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.font = '10px "Courier New", monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f1d49a';
    ctx.fillText('PERF METER', x + 8, y + 6);
    ctx.fillStyle = '#d6d6da';
    rows.forEach((line, i) => ctx.fillText(line, x + 8, y + 20 + i * 13));
    if (this.lastSlow) {
      ctx.fillStyle = '#ff9a80';
      ctx.fillText(`slow: ${this.lastSlow.worst} ${this.lastSlow.worstMs}ms`,
        x + 8, y + 20 + rows.length * 13);
    }
    ctx.restore();
  }
}

export const perfMeter = new PerfMeter();
