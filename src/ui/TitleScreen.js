/**
 * TitleScreen — first scene the player sees. Implements the Scene contract
 * (enter/render/handleInput).
 *
 * Buttons:
 *   New Run  — emit request:newRun
 *   Resume   — only shown if SaveManager has a run snapshot (v0.2+)
 *   Settings — toggle volume (v0.1 minimal)
 *   Controls — modal cheat-sheet
 */
import { COLOR, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config/constants.js';

const BUTTONS = [
  { id: 'newRun',   label: 'NEW RUN' },
  { id: 'shop',     label: 'SHOP' },
  { id: 'controls', label: 'CONTROLS' },
  { id: 'settings', label: 'SETTINGS' }
];

export class TitleScreen {
  /**
   * @param {{ bus:object, state:object, content:object, metaProgress:object }} deps
   */
  constructor({ bus, state, content, metaProgress }) {
    this.bus = bus;
    this.state = state;
    this.content = content || {};
    this.meta = metaProgress;
    this.selected = 0;
    this.modal = null; // 'controls' | 'settings' | 'shop' | null
    this._particles = TitleScreen._seedParticles();
    this._t = 0;
    this._shopFeedback = '';
    this._shopFeedbackUntil = 0;
  }

  enter() {
    this.selected = 0;
    this.modal = null;
  }

  update(dt) {
    this._t += dt;
    for (const p of this._particles) {
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      if (p.y > CANVAS_HEIGHT) p.y = -4;
      if (p.x < 0) p.x = CANVAS_WIDTH;
      if (p.x > CANVAS_WIDTH) p.x = 0;
    }
  }

  render(renderer) {
    renderer.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, '#06060a');

    // drifting atmosphere particles
    for (const p of this._particles) {
      renderer.drawRect(p.x, p.y, p.size, p.size, p.color);
    }

    // Logo
    renderer.drawText('SHADOW DEPTHS', CANVAS_WIDTH / 2, 110,
      { size: 36, bold: true, align: 'center' });
    renderer.drawText('a melancholic descent', CANVAS_WIDTH / 2, 150,
      { size: 12, align: 'center', color: COLOR.textMuted });

    // High score + coin balance
    const hs = this.state.state.meta.highscore || 0;
    const coins = this.state.state.meta.coins || 0;
    if (hs > 0) {
      renderer.drawText(`High score: ${hs}`, CANVAS_WIDTH / 2, 175,
        { size: 11, align: 'center', color: COLOR.textXP });
    }
    renderer.drawText(`◈ ${coins} coins`, CANVAS_WIDTH / 2, 195,
      { size: 13, align: 'center', color: '#d6c87a', bold: true });

    // Buttons — lowered for thumb reach on portrait phones.
    const baseY = 360;
    for (let i = 0; i < BUTTONS.length; i++) {
      const y = baseY + i * 64;
      const selected = i === this.selected;
      const w = 260, h = 52, x = (CANVAS_WIDTH - w) / 2;
      renderer.drawRect(x, y, w, h, selected ? '#2a2438' : '#16141c');
      renderer.drawStrokedRect(x, y, w, h, selected ? '#d6c87a' : '#3a3340', selected ? 2 : 1);
      renderer.drawText(BUTTONS[i].label, CANVAS_WIDTH / 2, y + h / 2,
        { size: 16, bold: true, align: 'center', baseline: 'middle' });
    }

    renderer.drawText('tap a button   ·   arrows + enter on keyboard',
      CANVAS_WIDTH / 2, CANVAS_HEIGHT - 24,
      { size: 10, align: 'center', color: COLOR.textMuted });

    if (this.modal === 'controls') this._renderControls(renderer);
    else if (this.modal === 'settings') this._renderSettings(renderer);
    else if (this.modal === 'shop') this._renderShop(renderer);
  }

  handleInput(action) {
    if (this.modal) {
      // Keyboard fallback: any of these close any modal.
      if (action.type === 'escape' || action.type === 'inventory') {
        this.modal = null;
        return;
      }
      if (action.type === 'tap') {
        const idx = action.buttonIndex;
        if (idx === 99) { this.modal = null; return; }
        // Shop BUY button → idx 200+i.
        if (this.modal === 'shop' && typeof idx === 'number' && idx >= 200) {
          const upgrades = this.content.shop?.upgrades || [];
          const u = upgrades[idx - 200];
          if (u) this._tryPurchase(u);
          return;
        }
        // Orientation toggle in Settings modal — 300=portrait, 301=landscape.
        if (this.modal === 'settings' && (idx === 300 || idx === 301)) {
          const mode = idx === 300 ? 'portrait' : 'landscape';
          if (this.meta) {
            this.meta.setSetting('orientation', mode);
            // Reload to apply new layout (constants.js reads at module load).
            setTimeout(() => location.reload(), 200);
          }
          return;
        }
        // Tap-outside fallback (sentinel 98) — close non-shop modals.
        if (this.modal !== 'shop' && this.modal !== 'settings' && idx === 98) {
          this.modal = null;
        }
      }
      return;
    }
    switch (action.type) {
      case 'move':
        if (action.dy === -1) this.selected = (this.selected + BUTTONS.length - 1) % BUTTONS.length;
        else if (action.dy === 1) this.selected = (this.selected + 1) % BUTTONS.length;
        break;
      case 'confirm':
        this._activate(BUTTONS[this.selected].id);
        break;
      case 'tap':
        if (typeof action.buttonIndex === 'number' &&
            action.buttonIndex >= 0 && action.buttonIndex < BUTTONS.length) {
          this.selected = action.buttonIndex;
          this._activate(BUTTONS[action.buttonIndex].id);
        }
        break;
    }
  }

  _activate(id) {
    if (id === 'newRun') this.bus.emit('request:newRun', {});
    else if (id === 'controls') this.modal = 'controls';
    else if (id === 'settings') this.modal = 'settings';
    else if (id === 'shop') this.modal = 'shop';
  }

  _renderShop(r) {
    const upgrades = this.content.shop?.upgrades || [];
    const rowH = 56;
    const headerH = 64;
    const modalH = headerH + upgrades.length * rowH + 80;
    const modalY = Math.max(20, (CANVAS_HEIGHT - modalH) / 2 - 40);

    r.drawRect(20, modalY, CANVAS_WIDTH - 40, modalH, 'rgba(0,0,0,0.96)');
    r.drawStrokedRect(20, modalY, CANVAS_WIDTH - 40, modalH, '#d6c87a', 2);

    r.drawText('SHOP', CANVAS_WIDTH / 2, modalY + 22,
      { size: 20, bold: true, align: 'center', color: '#d6c87a' });
    const coins = this.state.state.meta.coins || 0;
    r.drawText(`◈ ${coins} coins`, CANVAS_WIDTH / 2, modalY + 46,
      { size: 12, align: 'center', color: COLOR.textXP });

    for (let i = 0; i < upgrades.length; i++) {
      const u = upgrades[i];
      const y = modalY + headerH + i * rowH;
      const ownedLevel = this.meta?.upgradeLevel(u.id) || 0;
      const maxed = ownedLevel >= (u.maxLevel || 1);
      const cost = TitleScreen._nextCost(u, ownedLevel);
      const canAfford = coins >= cost;

      r.drawRect(28, y, CANVAS_WIDTH - 56, rowH - 6, '#16141c');
      r.drawStrokedRect(28, y, CANVAS_WIDTH - 56, rowH - 6, '#3a3340', 1);

      // Name + level chip
      const levelTxt = u.maxLevel > 1 ? `  ${ownedLevel}/${u.maxLevel}` : (ownedLevel > 0 ? '  OWNED' : '');
      r.drawText(`${u.name}${levelTxt}`, 36, y + 6,
        { size: 12, bold: true, color: '#e6e0c0' });
      r.drawText(u.description, 36, y + 24,
        { size: 10, color: COLOR.textMuted });

      // BUY button on the right
      const btnW = 80, btnH = 36;
      const btnX = CANVAS_WIDTH - 36 - btnW;
      const btnY = y + (rowH - 6 - btnH) / 2;
      const bgColor = maxed ? '#222028'
                   : canAfford ? '#2e3a2a' : '#3a2e2a';
      const borderColor = maxed ? '#3a3340'
                       : canAfford ? '#80c060' : '#a06060';
      r.drawRect(btnX, btnY, btnW, btnH, bgColor);
      r.drawStrokedRect(btnX, btnY, btnW, btnH, borderColor, 2);
      const label = maxed ? 'MAX' : `${cost} ◈`;
      r.drawText(label, btnX + btnW / 2, btnY + btnH / 2,
        { size: 12, bold: true, align: 'center', baseline: 'middle',
          color: maxed ? COLOR.textMuted : (canAfford ? '#80ff80' : '#ff8080') });
    }

    if (this._shopFeedback && this._t < this._shopFeedbackUntil) {
      r.drawText(this._shopFeedback,
        CANVAS_WIDTH / 2, modalY + modalH - 56,
        { size: 11, align: 'center', color: COLOR.textHeal });
    }

    this._renderModalCloseButton(r);
  }

  static _nextCost(u, currentLevel) {
    return (u.cost ?? 0) + (u.costGrowth ?? 0) * currentLevel;
  }

  _tryPurchase(upgrade) {
    if (!this.meta) return;
    const ok = this.meta.purchaseUpgrade(upgrade);
    if (ok) {
      this._shopFeedback = `Bought: ${upgrade.name}`;
    } else {
      const ownedLevel = this.meta.upgradeLevel(upgrade.id);
      if (ownedLevel >= (upgrade.maxLevel || 1)) {
        this._shopFeedback = 'Already at max level.';
      } else {
        this._shopFeedback = 'Not enough coins.';
      }
    }
    this._shopFeedbackUntil = this._t + 2.5;
    // Reflect new coin balance immediately.
    Object.assign(this.state.state.meta, this.meta.state);
  }

  _modalCloseRect() {
    const w = 200, h = 48;
    return {
      x: (CANVAS_WIDTH - w) / 2,
      y: CANVAS_HEIGHT - 120,
      w, h
    };
  }

  _renderModalCloseButton(r) {
    const rect = this._modalCloseRect();
    r.drawRect(rect.x, rect.y, rect.w, rect.h, '#2a2438');
    r.drawStrokedRect(rect.x, rect.y, rect.w, rect.h, '#d6c87a', 2);
    r.drawText('CLOSE', rect.x + rect.w / 2, rect.y + rect.h / 2,
      { size: 14, bold: true, align: 'center', baseline: 'middle' });
  }

  _renderControls(r) {
    const lines = [
      'CONTROLS',
      '',
      'Mobile:',
      '  D-pad bottom-left moves you',
      '  Center · = wait one turn',
      '  PICK = item under foot',
      '  DOWN = descend stairs',
      '  BAG  = open inventory',
      '  Tap a world tile to walk',
      '',
      'Keyboard (desktop):',
      '  Arrows / WASD / HJKL move',
      '  Space / . wait',
      '  G / Enter pickup',
      '  > descend, I/Tab inventory',
      '  M minimap, 1-9 hotkey'
    ];
    r.drawRect(40, 50, CANVAS_WIDTH - 80, CANVAS_HEIGHT - 200, 'rgba(0,0,0,0.94)');
    r.drawStrokedRect(40, 50, CANVAS_WIDTH - 80, CANVAS_HEIGHT - 200, '#3a3340', 1);
    for (let i = 0; i < lines.length; i++) {
      r.drawText(lines[i], CANVAS_WIDTH / 2, 78 + i * 22, {
        size: i === 0 ? 18 : 12, bold: i === 0, align: 'center',
        color: i === 0 ? '#d6c87a' : COLOR.textPrimary
      });
    }
    this._renderModalCloseButton(r);
  }

  _renderSettings(r) {
    const settings = this.state.state.meta.settings || {};
    const vol = Math.round((settings.volume || 0) * 100);
    const orient = settings.orientation || 'portrait';
    const modalH = 360;
    const modalY = Math.max(20, (CANVAS_HEIGHT - modalH) / 2 - 60);
    r.drawRect(40, modalY, CANVAS_WIDTH - 80, modalH, 'rgba(0,0,0,0.94)');
    r.drawStrokedRect(40, modalY, CANVAS_WIDTH - 80, modalH, '#3a3340', 1);
    r.drawText('SETTINGS', CANVAS_WIDTH / 2, modalY + 28,
      { size: 18, bold: true, align: 'center', color: '#d6c87a' });

    r.drawText(`Volume: ${vol}%`, CANVAS_WIDTH / 2, modalY + 80,
      { size: 14, align: 'center' });
    r.drawText('(slider UI lands in v0.3)', CANVAS_WIDTH / 2, modalY + 100,
      { size: 10, align: 'center', color: COLOR.textMuted });

    // Orientation toggle.
    r.drawText('Orientation', CANVAS_WIDTH / 2, modalY + 144,
      { size: 14, align: 'center' });
    const btnW = 120, btnH = 44, gap = 12;
    const totalW = btnW * 2 + gap;
    const baseX = (CANVAS_WIDTH - totalW) / 2;
    const btnY = modalY + 172;
    for (let i = 0; i < 2; i++) {
      const key = i === 0 ? 'portrait' : 'landscape';
      const label = i === 0 ? 'PORTRAIT' : 'LANDSCAPE';
      const active = orient === key;
      const bx = baseX + i * (btnW + gap);
      r.drawRect(bx, btnY, btnW, btnH, active ? '#2a2438' : '#16141c');
      r.drawStrokedRect(bx, btnY, btnW, btnH, active ? '#d6c87a' : '#3a3340', active ? 2 : 1);
      r.drawText(label, bx + btnW / 2, btnY + btnH / 2,
        { size: 12, bold: true, align: 'center', baseline: 'middle' });
    }
    r.drawText('change requires reload',
      CANVAS_WIDTH / 2, btnY + btnH + 16,
      { size: 10, align: 'center', color: COLOR.textMuted });

    this._renderModalCloseButton(r);
  }

  _settingsOrientationHitTest(x, y) {
    if (this.modal !== 'settings') return null;
    const modalH = 360;
    const modalY = Math.max(20, (CANVAS_HEIGHT - modalH) / 2 - 60);
    const btnW = 120, btnH = 44, gap = 12;
    const totalW = btnW * 2 + gap;
    const baseX = (CANVAS_WIDTH - totalW) / 2;
    const btnY = modalY + 172;
    for (let i = 0; i < 2; i++) {
      const bx = baseX + i * (btnW + gap);
      if (x >= bx && x <= bx + btnW && y >= btnY && y <= btnY + btnH) {
        return i === 0 ? 'portrait' : 'landscape';
      }
    }
    return null;
  }

  /**
   * Hit-test for touch taps. Returns 0-based button index or -1.
   * Special sentinels:
   *   99  → close button on any modal
   *   98  → tap-anywhere-outside fallback to close
   *   200+i → BUY button for shop upgrade index i (shop modal only)
   */
  hitTest(x, y) {
    if (this.modal === 'shop') {
      // BUY buttons first — they are precise hits.
      const upgrades = this.content.shop?.upgrades || [];
      const rowH = 56;
      const headerH = 64;
      const modalH = headerH + upgrades.length * rowH + 80;
      const modalY = Math.max(20, (CANVAS_HEIGHT - modalH) / 2 - 40);
      const btnW = 80, btnH = 36;
      const btnX = CANVAS_WIDTH - 36 - btnW;
      for (let i = 0; i < upgrades.length; i++) {
        const rowY = modalY + headerH + i * rowH;
        const btnY = rowY + (rowH - 6 - btnH) / 2;
        if (x >= btnX && x <= btnX + btnW &&
            y >= btnY && y <= btnY + btnH) {
          return 200 + i;
        }
      }
      const closeRect = this._modalCloseRect();
      if (x >= closeRect.x && x <= closeRect.x + closeRect.w &&
          y >= closeRect.y && y <= closeRect.y + closeRect.h) {
        return 99;
      }
      return -1; // taps elsewhere on shop do NOT close (don't lose progress)
    }

    if (this.modal === 'settings') {
      const orient = this._settingsOrientationHitTest(x, y);
      if (orient) return orient === 'portrait' ? 300 : 301;
      const rect = this._modalCloseRect();
      if (x >= rect.x && x <= rect.x + rect.w &&
          y >= rect.y && y <= rect.y + rect.h) {
        return 99;
      }
      return -1; // don't auto-close on outside tap inside settings
    }
    if (this.modal) {
      const rect = this._modalCloseRect();
      if (x >= rect.x && x <= rect.x + rect.w &&
          y >= rect.y && y <= rect.y + rect.h) {
        return 99;
      }
      return 98;
    }
    const baseY = 360, w = 260, h = 52;
    const bx = (CANVAS_WIDTH - w) / 2;
    for (let i = 0; i < BUTTONS.length; i++) {
      const by = baseY + i * 64;
      if (x >= bx && x <= bx + w && y >= by && y <= by + h) return i;
    }
    return -1;
  }

  static _seedParticles() {
    const arr = [];
    for (let i = 0; i < 40; i++) {
      arr.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        vx: (Math.random() - 0.5) * 6,
        vy: 4 + Math.random() * 10,
        size: 1 + Math.floor(Math.random() * 2),
        color: ['#1a1830', '#26243a', '#1c1a28'][Math.floor(Math.random() * 3)]
      });
    }
    return arr;
  }
}
