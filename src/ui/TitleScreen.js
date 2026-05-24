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
import { COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE } from '../config/constants.js';

const BUTTONS = [
  { id: 'newRun',   label: 'NEW RUN' },
  { id: 'shop',     label: 'SHOP' },
  { id: 'controls', label: 'CONTROLS' },
  { id: 'settings', label: 'SETTINGS' }
];

// Layout config — portrait vs landscape. All Y positions and dimensions
// for the title screen flow through this so a single source change moves
// everything in lockstep (and hit-tests automatically follow).
const LAYOUT = IS_LANDSCAPE
  ? {
      logoY: 36, logoSize: 28, subY: 60, subSize: 11,
      hsY: 80, coinY: 100,
      baseY: 130, btnW: 240, btnH: 44, btnGap: 10,
      footerY: CANVAS_HEIGHT - 16
    }
  : {
      logoY: 110, logoSize: 36, subY: 150, subSize: 12,
      hsY: 175, coinY: 195,
      baseY: 360, btnW: 260, btnH: 52, btnGap: 12,
      footerY: CANVAS_HEIGHT - 24
    };

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
    renderer.drawText('SHADOW DEPTHS', CANVAS_WIDTH / 2, LAYOUT.logoY,
      { size: LAYOUT.logoSize, bold: true, align: 'center' });
    renderer.drawText('a melancholic descent', CANVAS_WIDTH / 2, LAYOUT.subY,
      { size: LAYOUT.subSize, align: 'center', color: COLOR.textMuted });

    // High score + coin balance
    const hs = this.state.state.meta.highscore || 0;
    const coins = this.state.state.meta.coins || 0;
    if (hs > 0) {
      renderer.drawText(`High score: ${hs}`, CANVAS_WIDTH / 2, LAYOUT.hsY,
        { size: 11, align: 'center', color: COLOR.textXP });
    }
    renderer.drawText(`◈ ${coins} coins`, CANVAS_WIDTH / 2, LAYOUT.coinY,
      { size: 13, align: 'center', color: '#d6c87a', bold: true });

    // Buttons — sized to fit current orientation. Hit-test uses the same LAYOUT.
    const rowH = LAYOUT.btnH + LAYOUT.btnGap;
    const x = (CANVAS_WIDTH - LAYOUT.btnW) / 2;
    for (let i = 0; i < BUTTONS.length; i++) {
      const y = LAYOUT.baseY + i * rowH;
      const selected = i === this.selected;
      renderer.drawRect(x, y, LAYOUT.btnW, LAYOUT.btnH, selected ? '#2a2438' : '#16141c');
      renderer.drawStrokedRect(x, y, LAYOUT.btnW, LAYOUT.btnH,
        selected ? '#d6c87a' : '#3a3340', selected ? 2 : 1);
      renderer.drawText(BUTTONS[i].label, CANVAS_WIDTH / 2, y + LAYOUT.btnH / 2,
        { size: 15, bold: true, align: 'center', baseline: 'middle' });
    }

    renderer.drawText('tap a button   ·   arrows + enter on keyboard',
      CANVAS_WIDTH / 2, LAYOUT.footerY,
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

  /**
   * Shared shop modal geometry. Returns per-card rects (cards is the array
   * of {x,y,w,h} for each upgrade) so hitTest and render don't drift.
   */
  _shopGeometry() {
    const upgrades = this.content.shop?.upgrades || [];
    const cols = IS_LANDSCAPE ? 2 : 1;
    const rows = Math.ceil(upgrades.length / cols);
    const rowH = IS_LANDSCAPE ? 64 : 58;
    const headerH = 56;
    const closeH = IS_LANDSCAPE ? 40 : 48;
    const closeMargin = 12;
    const modalH = headerH + rows * rowH + closeH + closeMargin * 2 + 8;
    const modalY = Math.max(8, (CANVAS_HEIGHT - modalH) / 2);
    const modalX = 16;
    const modalW = CANVAS_WIDTH - modalX * 2;
    const cardPad = 8;
    const cardGap = 8;
    const cardW = (modalW - cardPad * 2 - cardGap * (cols - 1)) / cols;
    const cardH = rowH - cardGap;
    const cards = [];
    for (let i = 0; i < upgrades.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = modalX + cardPad + col * (cardW + cardGap);
      const cy = modalY + headerH + row * rowH;
      cards.push({ x: cx, y: cy, w: cardW, h: cardH });
    }
    return {
      modalX, modalY, modalW, modalH,
      headerH, closeH, closeMargin,
      closeY: modalY + modalH - closeH - closeMargin,
      cards
    };
  }

  _renderShop(r) {
    const upgrades = this.content.shop?.upgrades || [];
    const g = this._shopGeometry();
    const coins = this.state.state.meta.coins || 0;

    r.drawRect(g.modalX, g.modalY, g.modalW, g.modalH, 'rgba(0,0,0,0.96)');
    r.drawStrokedRect(g.modalX, g.modalY, g.modalW, g.modalH, '#d6c87a', 2);

    r.drawText('SHOP', CANVAS_WIDTH / 2, g.modalY + 18,
      { size: 18, bold: true, align: 'center', color: '#d6c87a' });
    r.drawText(`◈ ${coins} coins`, CANVAS_WIDTH / 2, g.modalY + 40,
      { size: 11, align: 'center', color: COLOR.textXP });

    for (let i = 0; i < upgrades.length; i++) {
      const u = upgrades[i];
      const card = g.cards[i];
      const ownedLevel = this.meta?.upgradeLevel(u.id) || 0;
      const maxed = ownedLevel >= (u.maxLevel || 1);
      const cost = TitleScreen._nextCost(u, ownedLevel);
      const canAfford = coins >= cost;

      r.drawRect(card.x, card.y, card.w, card.h, '#16141c');
      r.drawStrokedRect(card.x, card.y, card.w, card.h, '#3a3340', 1);

      const levelTxt = u.maxLevel > 1
        ? `  ${ownedLevel}/${u.maxLevel}`
        : (ownedLevel > 0 ? '  OWNED' : '');
      r.drawText(`${u.name}${levelTxt}`, card.x + 8, card.y + 6,
        { size: 11, bold: true, color: '#e6e0c0' });
      r.drawText(u.description, card.x + 8, card.y + 22,
        { size: 9, color: COLOR.textMuted });

      const btnW = 72, btnH = 30;
      const btnX = card.x + card.w - btnW - 8;
      const btnY = card.y + card.h - btnH - 6;
      const bgColor = maxed ? '#222028'
                   : canAfford ? '#2e3a2a' : '#3a2e2a';
      const borderColor = maxed ? '#3a3340'
                       : canAfford ? '#80c060' : '#a06060';
      r.drawRect(btnX, btnY, btnW, btnH, bgColor);
      r.drawStrokedRect(btnX, btnY, btnW, btnH, borderColor, 2);
      const label = maxed ? 'MAX' : `${cost} ◈`;
      r.drawText(label, btnX + btnW / 2, btnY + btnH / 2,
        { size: 11, bold: true, align: 'center', baseline: 'middle',
          color: maxed ? COLOR.textMuted : (canAfford ? '#80ff80' : '#ff8080') });
    }

    if (this._shopFeedback && this._t < this._shopFeedbackUntil) {
      r.drawText(this._shopFeedback,
        CANVAS_WIDTH / 2, g.closeY - 8,
        { size: 11, align: 'center', color: COLOR.textHeal });
    }

    this._renderModalCloseButton(r, g.closeY);
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

  /**
   * Close-button rect for a modal. Optional explicit y to anchor the
   * button to a known position (e.g. just below a modal box). Default
   * placement is near the bottom of the screen with enough margin so
   * mobile UI overlays never cover it.
   */
  _modalCloseRect(explicitY) {
    const w = IS_LANDSCAPE ? 160 : 200;
    const h = IS_LANDSCAPE ? 40  : 48;
    const y = typeof explicitY === 'number'
      ? explicitY
      : (IS_LANDSCAPE ? CANVAS_HEIGHT - 56 : CANVAS_HEIGHT - 120);
    return { x: (CANVAS_WIDTH - w) / 2, y, w, h };
  }

  _renderModalCloseButton(r, explicitY) {
    const rect = this._modalCloseRect(explicitY);
    r.drawRect(rect.x, rect.y, rect.w, rect.h, '#2a2438');
    r.drawStrokedRect(rect.x, rect.y, rect.w, rect.h, '#d6c87a', 2);
    r.drawText('CLOSE', rect.x + rect.w / 2, rect.y + rect.h / 2,
      { size: 14, bold: true, align: 'center', baseline: 'middle' });
  }

  /** Compute Controls modal geometry — shared by render + hitTest. */
  _controlsGeometry() {
    const totalLines = 16;
    const lineSpacing = IS_LANDSCAPE ? 16 : 22;
    const closeH      = IS_LANDSCAPE ? 40 : 48;
    const closeMargin = 14;
    const padding     = IS_LANDSCAPE ? 30 : 50;
    const contentH    = totalLines * lineSpacing + 16;
    const modalH      = contentH + closeH + closeMargin * 2;
    const modalY      = Math.max(12, (CANVAS_HEIGHT - modalH) / 2);
    return {
      modalY, modalH,
      closeY: modalY + modalH - closeH - closeMargin
    };
  }

  _renderControls(r) {
    const lines = [
      'CONTROLS',
      '',
      'Mobile:',
      '  D-pad moves you  ·  · = wait',
      '  PICK = grab item under foot',
      '  DOWN = descend the stairs',
      '  BAG  = open inventory',
      '  Tap a world tile to walk to it',
      '',
      'Keyboard (desktop):',
      '  Arrows / WASD / HJKL  move',
      '  Space / .  wait',
      '  G / Enter  pickup',
      '  >  descend     I/Tab  inventory',
      '  M  minimap     1-9    hotkeys'
    ];
    const lineSpacing = IS_LANDSCAPE ? 16 : 22;
    const lineSize    = IS_LANDSCAPE ? 11 : 12;
    const headerSize  = IS_LANDSCAPE ? 16 : 18;
    const closeH      = IS_LANDSCAPE ? 40 : 48;
    const closeMargin = 14;
    const padding     = IS_LANDSCAPE ? 30 : 50;
    const contentH    = lines.length * lineSpacing + 16;
    const modalH      = contentH + closeH + closeMargin * 2;
    const modalY      = Math.max(12, (CANVAS_HEIGHT - modalH) / 2);
    const modalX      = IS_LANDSCAPE ? 60 : 40;
    const modalW      = CANVAS_WIDTH - modalX * 2;

    r.drawRect(modalX, modalY, modalW, modalH, 'rgba(0,0,0,0.94)');
    r.drawStrokedRect(modalX, modalY, modalW, modalH, '#3a3340', 1);

    for (let i = 0; i < lines.length; i++) {
      r.drawText(lines[i], CANVAS_WIDTH / 2, modalY + padding + i * lineSpacing, {
        size: i === 0 ? headerSize : lineSize, bold: i === 0, align: 'center',
        color: i === 0 ? '#d6c87a' : COLOR.textPrimary
      });
    }
    // Close button anchored to modal bottom so it's always reachable.
    const closeY = modalY + modalH - closeH - closeMargin;
    this._renderModalCloseButton(r, closeY);
  }

  /** Single geometry source for both render + hit-test of settings modal. */
  _settingsGeometry() {
    const modalH = IS_LANDSCAPE ? 280 : 360;
    const modalY = Math.max(16, (CANVAS_HEIGHT - modalH) / 2 - (IS_LANDSCAPE ? 20 : 60));
    const modalX = IS_LANDSCAPE ? 60 : 40;
    const modalW = CANVAS_WIDTH - modalX * 2;
    const btnW = IS_LANDSCAPE ? 130 : 140;
    const btnH = IS_LANDSCAPE ? 40  : 44;
    const btnGap = 14;
    const totalW = btnW * 2 + btnGap;
    const baseX = (CANVAS_WIDTH - totalW) / 2;
    // Place orientation buttons high enough that they always fit before
    // the close button. closeY = modalY + modalH - closeH - padding.
    const closeH = IS_LANDSCAPE ? 40 : 48;
    const closeY = modalY + modalH - closeH - 14;
    const btnY   = closeY - btnH - 18;
    return { modalX, modalY, modalW, modalH, btnW, btnH, btnGap, baseX, btnY, closeY };
  }

  _renderSettings(r) {
    const settings = this.state.state.meta.settings || {};
    const vol = Math.round((settings.volume || 0) * 100);
    const orient = settings.orientation || 'portrait';
    const g = this._settingsGeometry();

    r.drawRect(g.modalX, g.modalY, g.modalW, g.modalH, 'rgba(0,0,0,0.94)');
    r.drawStrokedRect(g.modalX, g.modalY, g.modalW, g.modalH, '#3a3340', 1);

    r.drawText('SETTINGS', CANVAS_WIDTH / 2, g.modalY + 22,
      { size: 18, bold: true, align: 'center', color: '#d6c87a' });

    r.drawText(`Volume: ${vol}%`, CANVAS_WIDTH / 2, g.modalY + 52,
      { size: 13, align: 'center' });

    r.drawText('Orientation', CANVAS_WIDTH / 2, g.btnY - 22,
      { size: 13, align: 'center' });
    for (let i = 0; i < 2; i++) {
      const key = i === 0 ? 'portrait' : 'landscape';
      const label = i === 0 ? 'PORTRAIT' : 'LANDSCAPE';
      const active = orient === key;
      const bx = g.baseX + i * (g.btnW + g.btnGap);
      r.drawRect(bx, g.btnY, g.btnW, g.btnH, active ? '#2a2438' : '#16141c');
      r.drawStrokedRect(bx, g.btnY, g.btnW, g.btnH,
        active ? '#d6c87a' : '#3a3340', active ? 2 : 1);
      r.drawText(label, bx + g.btnW / 2, g.btnY + g.btnH / 2,
        { size: 12, bold: true, align: 'center', baseline: 'middle' });
    }
    r.drawText('tap to toggle  ·  reloads game',
      CANVAS_WIDTH / 2, g.btnY + g.btnH + 6,
      { size: 9, align: 'center', color: COLOR.textMuted });

    // Anchor close button INSIDE the modal so it's always reachable
    // regardless of canvas height.
    this._renderModalCloseButton(r, g.closeY);
  }

  _settingsOrientationHitTest(x, y) {
    if (this.modal !== 'settings') return null;
    const g = this._settingsGeometry();
    for (let i = 0; i < 2; i++) {
      const bx = g.baseX + i * (g.btnW + g.btnGap);
      if (x >= bx && x <= bx + g.btnW && y >= g.btnY && y <= g.btnY + g.btnH) {
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
      const g = this._shopGeometry();
      const btnW = 72, btnH = 30;
      for (let i = 0; i < g.cards.length; i++) {
        const card = g.cards[i];
        const btnX = card.x + card.w - btnW - 8;
        const btnY = card.y + card.h - btnH - 6;
        if (x >= btnX && x <= btnX + btnW &&
            y >= btnY && y <= btnY + btnH) {
          return 200 + i;
        }
      }
      const closeRect = this._modalCloseRect(g.closeY);
      if (x >= closeRect.x && x <= closeRect.x + closeRect.w &&
          y >= closeRect.y && y <= closeRect.y + closeRect.h) {
        return 99;
      }
      return -1;
    }

    if (this.modal === 'settings') {
      const orient = this._settingsOrientationHitTest(x, y);
      if (orient) return orient === 'portrait' ? 300 : 301;
      const g = this._settingsGeometry();
      const rect = this._modalCloseRect(g.closeY);
      if (x >= rect.x && x <= rect.x + rect.w &&
          y >= rect.y && y <= rect.y + rect.h) {
        return 99;
      }
      return -1; // don't auto-close on outside tap inside settings
    }
    if (this.modal === 'controls') {
      const g = this._controlsGeometry();
      const rect = this._modalCloseRect(g.closeY);
      if (x >= rect.x && x <= rect.x + rect.w &&
          y >= rect.y && y <= rect.y + rect.h) {
        return 99;
      }
      // Tap outside controls modal also closes.
      return 98;
    }

    if (this.modal) {
      const rect = this._modalCloseRect();
      if (x >= rect.x && x <= rect.x + rect.w &&
          y >= rect.y && y <= rect.y + rect.h) {
        return 99;
      }
      return 98;
    }
    const rowH = LAYOUT.btnH + LAYOUT.btnGap;
    const bx = (CANVAS_WIDTH - LAYOUT.btnW) / 2;
    for (let i = 0; i < BUTTONS.length; i++) {
      const by = LAYOUT.baseY + i * rowH;
      if (x >= bx && x <= bx + LAYOUT.btnW && y >= by && y <= by + LAYOUT.btnH) return i;
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
