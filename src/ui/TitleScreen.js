/**
 * TitleScreen — main menu in the style of the Shadow Depths mock.
 *
 * Layout:
 *   - "SHADOW DEPTHS" big serif logo (Cinzel)
 *   - Star ornament + italic tagline (IM Fell English)
 *   - 6 menu rows (each with icon + label + right-side status text)
 *   - Footer stat line: "THE DEPTHS REMEMBER YOU · X FLOORS · Y FOES · Z RELICS"
 *
 * Menu rows include status info pulled from MetaProgress so the screen
 * feels alive — the menu remembers your last run, your codex progress,
 * your meta level, etc.
 */
import {
  COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE,
  FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize
} from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import { IRON, drawIronRivet, drawBrassRivet, drawBrassPiping } from './ironHud.js';

const BRASS_DARK = '#7a5c2c';
const BRASS = '#d4ac6c';
const BRASS_HI = '#f1d49a';
const BRASS_WHITE = '#fff5d0';

const MENU = [
  { id: 'newRun',   icon: '+', label: 'NEW DESCENT',  sub: 'Permadeath' },
  { id: 'daily',    icon: '☼', label: 'DAILY SEED',   sub: '' },
  { id: 'shop',     icon: '◈', label: 'EMPORIUM',     sub: '' },
  { id: 'codex',    icon: '✦', label: 'CODEX',        sub: '' },
  { id: 'meta',     icon: '★', label: 'META-PROGRESS',sub: '' },
  { id: 'settings', icon: '⚙', label: 'SETTINGS',     sub: '' }
];

const LAYOUT = IS_LANDSCAPE
  ? {
      logoY: 28, logoSize: 30, ornY: 56, tagY: 70, tagSize: 11,
      hsY: 92, coinY: 108,
      baseY: 138, rowH: 44, rowGap: 6, rowW: 360,
      footerY: CANVAS_HEIGHT - 14
    }
  : {
      logoY: 72, logoSize: 48, ornY: 128, tagY: 150, tagSize: 16,
      hsY: 178, coinY: 200,
      baseY: 238, rowH: 58, rowGap: 10, rowW: 360,
      footerY: CANVAS_HEIGHT - 28
    };

export class TitleScreen {
  /** @param {{ bus:object, state:object, content:object, metaProgress:object }} deps */
  constructor({ bus, state, content, metaProgress, characterSelect }) {
    this.characterSelect = characterSelect || null;
    if (bus && this.characterSelect) {
      bus.on('request:openCharacterSelect', (opts) => {
        this.modal = null; // close any open menu modal
        this.characterSelect.show(opts || {});
      });
    }
    this.bus = bus;
    this.state = state;
    this.content = content || {};
    this.meta = metaProgress;
    this.selected = 0;
    this.modal = null; // 'controls' | 'settings' | 'shop' | 'meta' | 'codex' | null
    this._particles = TitleScreen._seedParticles();
    this._t = 0;
    this._shopFeedback = '';
    this._shopFeedbackUntil = 0;
  }

  enter() { this.selected = 0; this.modal = null; }

  update(dt) {
    this._t += dt;
    for (const p of this._particles) {
      // Rising embers — gentle drift up + horizontal wobble + fade in/out.
      p.life += dt;
      p.y -= p.vy * dt;
      p.x += Math.sin(p.life * 1.4 + p.phase) * 8 * dt;
      p.alpha = Math.max(0, Math.min(p.peak, p.peak - Math.abs(p.life / p.duration - 0.5) * p.peak * 2));
      if (p.life > p.duration) {
        // Respawn at the bottom with a fresh trajectory.
        p.life = 0;
        p.x = Math.random() * CANVAS_WIDTH;
        p.y = CANVAS_HEIGHT + 8;
        p.vy = 22 + Math.random() * 26;
        p.duration = 5 + Math.random() * 4;
        p.phase = Math.random() * Math.PI * 2;
        p.peak = 0.5 + Math.random() * 0.4;
      }
    }
  }

  render(renderer) {
    this._renderBackdrop(renderer);
    const menuItems = this._menuItems();
    if (this.selected >= menuItems.length) this.selected = 0;

    // If the character picker is up, render it FULL-PANEL on top of the
    // title and skip the rest of the title decoration entirely.
    if (this.characterSelect?.open) {
      this.characterSelect.render(renderer);
      return;
    }

    // Rising embers (instead of falling dust)
    this._renderEmbers(renderer);

    // Brass ornament row above title — lines + ✶ + diamond + ✶ + lines
    this._renderTitleOrnament(renderer, LAYOUT.logoY - 22);

    const titleSize = TitleScreen._fitTitleSize(renderer, 'SHADOW DEPTHS', uiSize(LAYOUT.logoSize));
    this._renderShimmerTitle(renderer, 'SHADOW DEPTHS', CANVAS_WIDTH / 2, LAYOUT.logoY, titleSize);

    renderer.drawText('✦  ·  ✦', CANVAS_WIDTH / 2, LAYOUT.ornY,
      { size: uiSize(16), align: 'center', color: BRASS_DARK, family: FONT_DISPLAY });
    renderer.drawText('a melancholic descent', CANVAS_WIDTH / 2, LAYOUT.tagY,
      { size: uiSize(LAYOUT.tagSize), italic: true, align: 'center',
        family: FONT_BODY, color: COLOR.textMuted });

    // --- Stats: high score + coins ---
    const hs = this.state.state.meta.highscore || 0;
    const coins = this.state.state.meta.coins || 0;
    if (hs > 0) {
      renderer.drawText(`high score · ${hs}`, CANVAS_WIDTH / 2, LAYOUT.hsY,
        { size: uiSize(12), align: 'center', color: COLOR.textXP, family: FONT_BODY, italic: true });
    }
    renderer.drawText(`◈  ${coins} coins`, CANVAS_WIDTH / 2, LAYOUT.coinY,
      { size: uiSize(15), align: 'center', color: COLOR.gold, bold: true, family: FONT_MONO });

    // --- Menu rows ---
    this._renderMenuRows(renderer, menuItems);

    // --- Footer ---
    const runs = (this.state.state.meta.runsCompleted || 0) + (this.state.state.meta.runsDied || 0);
    const enemies = (this.state.state.meta.runHistory || [])
      .reduce((sum, r) => sum + (r.floorsCleared || 0) * 5, 0);
    const relics = Object.keys(this.content.items || {}).length;
    renderer.drawText(
      `the depths remember you  ·  ${runs} runs  ·  ${enemies}+ foes  ·  ${relics} relics`,
      CANVAS_WIDTH / 2, LAYOUT.footerY,
      { size: uiSize(11), italic: true, align: 'center', family: FONT_BODY, color: COLOR.textMuted }
    );

    if (this.modal === 'controls') this._renderControls(renderer);
    else if (this.modal === 'settings') this._renderSettings(renderer);
    else if (this.modal === 'shop') this._renderShop(renderer);
    else if (this.modal === 'meta') this._renderMeta(renderer);
    else if (this.modal === 'codex') this._renderCodex(renderer);
  }

  _menuItems() {
    const run = this.state.state.run;
    if (!run?.canContinue) return MENU;
    return [
      { id: 'continue', icon: '▶', label: 'CONTINUE', sub: '' },
      ...MENU
    ];
  }

  _renderMenuRows(r, menuItems = this._menuItems()) {
    const ctx = r.ctx;
    const t = this._t;
    const rowH = LAYOUT.rowH;
    const rowW = LAYOUT.rowW;
    const x = (CANVAS_WIDTH - rowW) / 2;
    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      const y = LAYOUT.baseY + i * (rowH + LAYOUT.rowGap);
      const selected = i === this.selected;
      ctx.save();
      // Iron-plate vertical gradient (selected rows shift one step lighter).
      const g = ctx.createLinearGradient(x, y, x, y + rowH);
      if (selected) {
        g.addColorStop(0, IRON.plate1);
        g.addColorStop(1, IRON.plate0);
      } else {
        g.addColorStop(0, IRON.plate0);
        g.addColorStop(1, IRON.ink);
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, y, rowW, rowH);

      // Hammered noise highlight.
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#a09aa0';
      const rg = ctx.createRadialGradient(x + rowW * 0.25, y + rowH * 0.3, 0,
        x + rowW * 0.25, y + rowH * 0.3, rowW * 0.4);
      rg.addColorStop(0, 'rgba(170,160,170,0.7)');
      rg.addColorStop(1, 'rgba(170,160,170,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(x, y, rowW, rowH);
      ctx.globalAlpha = 1;

      if (selected) {
        // Animated pulse-glow halo around selected row.
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.8);
        ctx.shadowColor = BRASS;
        ctx.shadowBlur = 8 + pulse * 14;
        ctx.strokeStyle = BRASS;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 0.5, y + 0.5, rowW - 1, rowH - 1);
        ctx.shadowBlur = 0;
        // Underline beneath label.
        ctx.fillStyle = BRASS;
        ctx.fillRect(x + 60, y + rowH - 12, 40, 1);
      } else {
        ctx.strokeStyle = IRON.ink;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.5, y + 0.5, rowW - 1, rowH - 1);
      }
      // Top bevel highlight + bottom shadow.
      ctx.fillStyle = `${IRON.plateHi}88`;
      ctx.fillRect(x + 1, y + 1, rowW - 2, 1);
      ctx.fillStyle = IRON.ink;
      ctx.fillRect(x + 1, y + rowH - 2, rowW - 2, 1);
      // Corner rivets for selected rows (matches jsx).
      if (selected) {
        drawBrassRivet(ctx, x + 5, y + 5, 2.5);
        drawBrassRivet(ctx, x + rowW - 5, y + 5, 2.5);
        drawBrassRivet(ctx, x + 5, y + rowH - 5, 2.5);
        drawBrassRivet(ctx, x + rowW - 5, y + rowH - 5, 2.5);
      }
      ctx.restore();

      const iconCx = x + 32;
      // Icon glow on selected — drop-shadow on the glyph itself.
      if (selected) {
        ctx.save();
        ctx.shadowColor = BRASS;
        ctx.shadowBlur = 6;
        r.drawText(item.icon, iconCx, y + rowH / 2,
          { size: uiSize(22), bold: true, align: 'center', baseline: 'middle',
            family: FONT_DISPLAY, color: BRASS });
        ctx.restore();
      } else {
        r.drawText(item.icon, iconCx, y + rowH / 2,
          { size: uiSize(20), bold: true, align: 'center', baseline: 'middle',
            family: FONT_DISPLAY, color: IRON.boneDim });
      }
      r.drawText(item.label, x + 62, y + rowH / 2,
        { size: uiSize(16), bold: true, align: 'left', baseline: 'middle',
          family: FONT_DISPLAY, color: selected ? BRASS_HI : IRON.bone });
      const sub = this._statusFor(item);
      if (sub) {
        r.drawText(sub, x + rowW - (selected ? 36 : 12), y + rowH / 2,
          { size: uiSize(12), italic: true, align: 'right', baseline: 'middle',
            family: FONT_BODY, color: selected ? BRASS : COLOR.textMuted });
      }
      if (selected) {
        // Bobbing arrow chevron on selected row (matches jsx sd-bob).
        const bob = Math.sin(this._t * 3.9) * 2;
        r.drawText('›', x + rowW - 18, y + rowH / 2 + bob, {
          size: uiSize(22), bold: true, align: 'center', baseline: 'middle',
          family: FONT_DISPLAY, color: BRASS
        });
      }
    }
  }

  /** Dynamic status text per row. */
  _statusFor(item) {
    if (item.id === 'continue') {
      const run = this.state.state.run || {};
      const floor = (run.floorIndex || 0) + 1;
      return `F${floor}/100 · Lv ${run.level || 1}`;
    }
    if (item.id === 'newRun') return 'permadeath';
    if (item.id === 'shop') {
      const coins = this.state.state.meta.coins || 0;
      return `${coins} ◈`;
    }
    if (item.id === 'meta') {
      const m = this.state.state.meta;
      const runs = (m.runsCompleted || 0) + (m.runsDied || 0);
      return runs > 0 ? `${runs} runs` : 'no runs yet';
    }
    if (item.id === 'codex') {
      const m = this.state.state.meta;
      const seen = (m.discoveredItems || []).length + (m.discoveredEnemies || []).length;
      const total = Object.keys(this.content.items || {}).length
                  + Object.keys(this.content.enemies || {}).length;
      return `${seen} / ${total} seen`;
    }
    if (item.id === 'daily') {
      const key = TitleScreen.dailyKey();
      const ds = this.state.state.meta.dailyScores || {};
      const best = ds[key];
      return best ? `best ${best}` : 'fresh';
    }
    if (item.id === 'settings') {
      const orient = this.state.state.meta.settings?.orientation || 'portrait';
      return orient;
    }
    return item.sub || '';
  }

  // --- input ---------------------------------------------------------
  handleInput(action) {
    // Character picker steals input first when open.
    if (this.characterSelect?.open) {
      if (action.type === 'pointer') {
        this.characterSelect.handleCanvasTap(action.x, action.y);
        return;
      }
      this.characterSelect.handleInput(action);
      return;
    }
    if (this.modal) {
      if (action.type === 'escape' || action.type === 'inventory') {
        this.modal = null; return;
      }
      if (action.type === 'tap') {
        const idx = action.buttonIndex;
        if (idx === 99) { this.modal = null; return; }
        if (this.modal === 'shop' && typeof idx === 'number' && idx >= 200 && idx < 300) {
          const upgrades = this.content.shop?.upgrades || [];
          const u = upgrades[idx - 200];
          if (u) this._tryPurchase(u);
          return;
        }
        if (this.modal === 'settings' && (idx === 300 || idx === 301)) {
          const mode = idx === 300 ? 'portrait' : 'landscape';
          if (this.meta) {
            this.meta.setSetting('orientation', mode);
            setTimeout(() => location.reload(), 200);
          }
          return;
        }
        if (this.modal === 'settings' && typeof idx === 'string' && idx.startsWith('diff:')) {
          if (this.meta) this.meta.setSetting('difficulty', idx.slice(5));
          return;
        }
        // Codex tab change (400 + i) and pagination (410=prev, 411=next).
        if (this.modal === 'codex') {
          if (typeof idx === 'number' && idx >= 400 && idx < 410) {
            const tabs = this._codexTabs();
            const t = tabs[idx - 400];
            if (t) { this._codexTab = t.id; this._codexPage = 0; }
            return;
          }
          if (idx === 410) { this._codexPage = Math.max(0, (this._codexPage || 0) - 1); return; }
          if (idx === 411) { this._codexPage = (this._codexPage || 0) + 1; return; }
        }
        if (this.modal !== 'shop' && this.modal !== 'settings' && this.modal !== 'codex' && idx === 98) {
          this.modal = null;
        }
      }
      return;
    }
    switch (action.type) {
      case 'move':
        if (action.dy === -1) this.selected = (this.selected + this._menuItems().length - 1) % this._menuItems().length;
        else if (action.dy === 1) this.selected = (this.selected + 1) % this._menuItems().length;
        break;
      case 'confirm':
        this._activate(this._menuItems()[this.selected].id);
        break;
      case 'tap':
        const menuItems = this._menuItems();
        if (typeof action.buttonIndex === 'number' &&
            action.buttonIndex >= 0 && action.buttonIndex < menuItems.length) {
          this.selected = action.buttonIndex;
          this._activate(menuItems[action.buttonIndex].id);
        }
        break;
    }
  }

  _activate(id) {
    if (id === 'continue') this.bus.emit('request:continueRun', {});
    else if (id === 'newRun') {
      // Open the character picker; it emits request:newRun with heroKind.
      this.bus.emit('request:openCharacterSelect', { mode: 'normal' });
    }
    else if (id === 'daily') {
      const seed = TitleScreen.dailySeed();
      // Same picker, but the daily seed is attached when the player chooses.
      this.bus.emit('request:openCharacterSelect', { mode: 'daily', seed });
    }
    else if (id === 'shop') this.modal = 'shop';
    else if (id === 'codex') {
      this.modal = 'codex';
      this._codexTab = 'items';
      this._codexPage = 0;
    }
    else if (id === 'meta') this.modal = 'meta';
    else if (id === 'controls') this.modal = 'controls';
    else if (id === 'settings') this.modal = 'settings';
  }

  /** Daily seed derived from today's YYYY-MM-DD. */
  static dailySeed() {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  static dailyKey() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // --- modal close ---------------------------------------------------
  _modalCloseRect(explicitY) {
    const w = IS_LANDSCAPE ? 160 : 200;
    const h = IS_LANDSCAPE ? 40  : 48;
    const y = typeof explicitY === 'number'
      ? explicitY
      : (IS_LANDSCAPE ? CANVAS_HEIGHT - 56 : Layout.canvasH - 72);
    return { x: (CANVAS_WIDTH - w) / 2, y, w, h };
  }
  _renderModalCloseButton(r, explicitY) {
    const rect = this._modalCloseRect(explicitY);
    r.drawRect(rect.x, rect.y, rect.w, rect.h, COLOR.bgCard);
    r.drawStrokedRect(rect.x, rect.y, rect.w, rect.h, COLOR.gold, 2);
    r.drawText('CLOSE', rect.x + rect.w / 2, rect.y + rect.h / 2,
      { size: 14, bold: true, align: 'center', baseline: 'middle',
        family: FONT_DISPLAY, color: COLOR.textPrimary });
  }

  // --- Controls modal -----------------------------------------------
  _controlsGeometry() {
    const totalLines = 16;
    const lineSpacing = IS_LANDSCAPE ? 16 : 22;
    const closeH = IS_LANDSCAPE ? 40 : 48;
    const closeMargin = 14;
    const contentH = totalLines * lineSpacing + 16;
    const modalH = contentH + closeH + closeMargin * 2;
    const modalY = Math.max(12, (CANVAS_HEIGHT - modalH) / 2);
    return { modalY, modalH, closeY: modalY + modalH - closeH - closeMargin };
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
      '  M  minimap     1-3    quick potions',
      '  4-9  bag slots'
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
    r.drawRect(modalX, modalY, modalW, modalH, COLOR.bgPanel);
    r.drawStrokedRect(modalX, modalY, modalW, modalH, COLOR.gold, 1);
    for (let i = 0; i < lines.length; i++) {
      r.drawText(lines[i], CANVAS_WIDTH / 2, modalY + padding + i * lineSpacing, {
        size: i === 0 ? headerSize : lineSize, bold: i === 0, align: 'center',
        family: i === 0 ? FONT_DISPLAY : FONT_BODY,
        color: i === 0 ? COLOR.gold : COLOR.textPrimary
      });
    }
    const closeY = modalY + modalH - closeH - closeMargin;
    this._renderModalCloseButton(r, closeY);
  }

  // --- Settings modal -----------------------------------------------
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
    const closeH = IS_LANDSCAPE ? 40 : 48;
    const closeY = modalY + modalH - closeH - 14;
    const btnY   = closeY - btnH - 18;
    return { modalX, modalY, modalW, modalH, btnW, btnH, btnGap, baseX, btnY, closeY };
  }
  _renderSettings(r) {
    const settings = this.state.state.meta.settings || {};
    const vol = Math.round((settings.volume || 0) * 100);
    const orient = settings.orientation || 'portrait';
    const difficulty = settings.difficulty || 'normal';
    const g = this._settingsGeometry();
    r.drawRect(g.modalX, g.modalY, g.modalW, g.modalH, COLOR.bgPanel);
    r.drawStrokedRect(g.modalX, g.modalY, g.modalW, g.modalH, COLOR.gold, 1);
    r.drawText('SETTINGS', CANVAS_WIDTH / 2, g.modalY + 22,
      { size: 18, bold: true, align: 'center', family: FONT_DISPLAY, color: COLOR.gold });
    r.drawText(`Volume: ${vol}%`, CANVAS_WIDTH / 2, g.modalY + 52,
      { size: 13, align: 'center', family: FONT_BODY });

    // Difficulty row — 4 pills above orientation.
    const diffRow = this._difficultyButtonRow();
    r.drawText('Difficulty', CANVAS_WIDTH / 2, diffRow.labelY,
      { size: 13, align: 'center', family: FONT_BODY });
    const diffKeys = ['easy', 'normal', 'hard', 'ascend1'];
    const diffLabels = { easy: 'EASY', normal: 'NORM', hard: 'HARD', ascend1: 'ASC1' };
    for (let i = 0; i < diffKeys.length; i++) {
      const key = diffKeys[i];
      const active = difficulty === key;
      const bx = diffRow.baseX + i * (diffRow.btnW + diffRow.gap);
      r.drawRect(bx, diffRow.y, diffRow.btnW, diffRow.btnH, active ? COLOR.bgCardHi : COLOR.bgCard);
      r.drawStrokedRect(bx, diffRow.y, diffRow.btnW, diffRow.btnH,
        active ? COLOR.gold : COLOR.borderSoft, active ? 2 : 1);
      r.drawText(diffLabels[key], bx + diffRow.btnW / 2, diffRow.y + diffRow.btnH / 2,
        { size: 11, bold: true, align: 'center', baseline: 'middle', family: FONT_DISPLAY });
    }

    r.drawText('Orientation', CANVAS_WIDTH / 2, g.btnY - 22,
      { size: 13, align: 'center', family: FONT_BODY });
    for (let i = 0; i < 2; i++) {
      const key = i === 0 ? 'portrait' : 'landscape';
      const label = i === 0 ? 'PORTRAIT' : 'LANDSCAPE';
      const active = orient === key;
      const bx = g.baseX + i * (g.btnW + g.btnGap);
      r.drawRect(bx, g.btnY, g.btnW, g.btnH, active ? COLOR.bgCardHi : COLOR.bgCard);
      r.drawStrokedRect(bx, g.btnY, g.btnW, g.btnH,
        active ? COLOR.gold : COLOR.borderSoft, active ? 2 : 1);
      r.drawText(label, bx + g.btnW / 2, g.btnY + g.btnH / 2,
        { size: 12, bold: true, align: 'center', baseline: 'middle',
          family: FONT_DISPLAY });
    }
    r.drawText('tap to toggle  ·  reloads game',
      CANVAS_WIDTH / 2, g.btnY + g.btnH + 6,
      { size: 9, italic: true, align: 'center', family: FONT_BODY, color: COLOR.textMuted });
    this._renderModalCloseButton(r, g.closeY);
  }
  _difficultyButtonRow() {
    const g = this._settingsGeometry();
    const btnW = 62;
    const btnH = 28;
    const gap = 8;
    const totalW = btnW * 4 + gap * 3;
    const baseX = (CANVAS_WIDTH - totalW) / 2;
    const labelY = g.modalY + 92;
    const y = labelY + 12;
    return { baseX, y, btnW, btnH, gap, labelY };
  }

  _settingsDifficultyHitTest(x, y) {
    if (this.modal !== 'settings') return null;
    const row = this._difficultyButtonRow();
    if (y < row.y || y > row.y + row.btnH) return null;
    const keys = ['easy', 'normal', 'hard', 'ascend1'];
    for (let i = 0; i < 4; i++) {
      const bx = row.baseX + i * (row.btnW + row.gap);
      if (x >= bx && x <= bx + row.btnW) return keys[i];
    }
    return null;
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

  // --- Meta-progress modal ------------------------------------------
  _renderMeta(r) {
    const m = this.state.state.meta;
    const lines = [
      ['Total runs',     (m.runsCompleted || 0) + (m.runsDied || 0)],
      ['Victories',      m.runsCompleted || 0],
      ['Deaths',         m.runsDied || 0],
      ['High score',     m.highscore || 0],
      ['Coins earned',   m.coins || 0],
      ['Upgrades owned', Object.values(m.shopUpgrades || {}).reduce((a, b) => a + b, 0)],
      ['Unlocks',        (m.unlocks || []).length]
    ];
    // Daily leaderboard — last 7 days of best scores.
    const dailyEntries = Object.entries(m.dailyScores || {})
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 7);
    const showLeaderboard = dailyEntries.length > 0;

    const lineSpacing = IS_LANDSCAPE ? 22 : 30;
    const leaderH = showLeaderboard ? (28 + dailyEntries.length * 16) : 0;
    const closeH = IS_LANDSCAPE ? 40 : 48;
    const closeMargin = 14;
    const contentH = lines.length * lineSpacing + 70 + leaderH;
    const modalH = contentH + closeH + closeMargin * 2;
    const modalY = Math.max(12, (CANVAS_HEIGHT - modalH) / 2);
    const modalX = IS_LANDSCAPE ? 60 : 40;
    const modalW = CANVAS_WIDTH - modalX * 2;
    r.drawRect(modalX, modalY, modalW, modalH, COLOR.bgPanel);
    r.drawStrokedRect(modalX, modalY, modalW, modalH, COLOR.gold, 1);
    r.drawText('META-PROGRESS', CANVAS_WIDTH / 2, modalY + 24,
      { size: 18, bold: true, align: 'center', family: FONT_DISPLAY, color: COLOR.gold });
    r.drawText('what the depths remember', CANVAS_WIDTH / 2, modalY + 46,
      { size: 10, italic: true, align: 'center', family: FONT_BODY, color: COLOR.textMuted });
    for (let i = 0; i < lines.length; i++) {
      const [label, value] = lines[i];
      const ly = modalY + 70 + i * lineSpacing;
      r.drawText(label, modalX + 24, ly,
        { size: 12, align: 'left', family: FONT_BODY, color: COLOR.textMuted });
      r.drawText(String(value), modalX + modalW - 24, ly,
        { size: 13, bold: true, align: 'right', family: FONT_MONO, color: COLOR.gold });
    }
    // Daily seed leaderboard rows.
    if (showLeaderboard) {
      const leaderY = modalY + 70 + lines.length * lineSpacing + 8;
      r.drawText('DAILY SEED — RECENT BEST', CANVAS_WIDTH / 2, leaderY,
        { size: 11, bold: true, align: 'center', family: FONT_DISPLAY, color: COLOR.gold });
      for (let i = 0; i < dailyEntries.length; i++) {
        const [date, score] = dailyEntries[i];
        const ly = leaderY + 18 + i * 16;
        r.drawText(date, modalX + 24, ly,
          { size: 11, align: 'left', family: FONT_MONO, color: COLOR.textMuted });
        r.drawText(String(score), modalX + modalW - 24, ly,
          { size: 11, align: 'right', family: FONT_MONO, color: COLOR.textXP });
      }
    }
    const closeY = modalY + modalH - closeH - closeMargin;
    this._renderModalCloseButton(r, closeY);
  }

  // --- Codex modal --------------------------------------------------
  _codexGeometry() {
    const canvasH = Layout.canvasH || CANVAS_HEIGHT;
    const canvasW = Layout.canvasW || CANVAS_WIDTH;
    const modalX = 12;
    const modalY = 16;
    const modalW = canvasW - 24;
    const modalH = canvasH - 32;
    const tabH = IS_LANDSCAPE ? 28 : 32;
    const tabY = modalY + (IS_LANDSCAPE ? 48 : 56);
    const listY = tabY + tabH + 8;
    const closeH = IS_LANDSCAPE ? 40 : 48;
    const closeY = modalY + modalH - closeH - 14;
    return { modalX, modalY, modalW, modalH, tabH, tabY, listY, closeH, closeY };
  }

  _codexTabs() {
    const m = this.state.state.meta;
    const seen = (m.discoveredItems || []).length;
    const allItems = Object.keys(this.content.items || {}).length;
    const seenE = (m.discoveredEnemies || []).length;
    const allE = Object.keys(this.content.enemies || {}).length;
    const seenB = (m.discoveredBiomes || []).length;
    const allB = (this.content.biomes?.biomes || []).length;
    const unlockedAch = (m.achievementsUnlocked || []).length;
    const allAch = (this.content.achievements?.achievements || []).length;
    return [
      { id: 'items',     label: 'ITEMS',   count: `${seen}/${allItems}` },
      { id: 'enemies',   label: 'HORRORS', count: `${seenE}/${allE}` },
      { id: 'biomes',    label: 'BIOMES',  count: `${seenB}/${allB}` },
      { id: 'achieve',   label: 'TROPHIES',count: `${unlockedAch}/${allAch}` }
    ];
  }

  _renderCodex(r) {
    if (!this._codexTab) this._codexTab = 'items';
    const g = this._codexGeometry();
    r.drawRect(g.modalX, g.modalY, g.modalW, g.modalH, COLOR.bgPanel);
    r.drawStrokedRect(g.modalX, g.modalY, g.modalW, g.modalH, COLOR.gold, 2);
    r.drawText('CODEX', CANVAS_WIDTH / 2, g.modalY + 18,
      { size: 18, bold: true, align: 'center', family: FONT_DISPLAY, color: COLOR.gold });
    r.drawText('a chronicle of what you have seen',
      CANVAS_WIDTH / 2, g.modalY + 38,
      { size: 10, italic: true, align: 'center', family: FONT_BODY, color: COLOR.textMuted });

    // Tabs
    const tabs = this._codexTabs();
    const tabW = (g.modalW - 16) / tabs.length;
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      const active = t.id === this._codexTab;
      const x = g.modalX + 8 + i * tabW;
      r.drawRect(x + 2, g.tabY, tabW - 4, g.tabH, active ? COLOR.bgCardHi : COLOR.bgCard);
      r.drawStrokedRect(x + 2, g.tabY, tabW - 4, g.tabH,
        active ? COLOR.gold : COLOR.borderSoft, active ? 2 : 1);
      r.drawText(t.label, x + tabW / 2, g.tabY + g.tabH / 2 - 4,
        { size: 11, bold: true, align: 'center', baseline: 'middle',
          family: FONT_DISPLAY, color: active ? COLOR.gold : COLOR.textMuted });
      r.drawText(t.count, x + tabW / 2, g.tabY + g.tabH - 8,
        { size: 9, align: 'center', baseline: 'middle',
          family: FONT_MONO, color: COLOR.textMuted });
    }

    // List rows.
    this._renderCodexList(r, g);

    this._renderModalCloseButton(r, g.closeY);
  }

  _renderCodexList(r, g) {
    const tab = this._codexTab;
    const m = this.state.state.meta;
    let entries = [];
    if (tab === 'items') {
      const defs = this.content.items || {};
      const seen = new Set(m.discoveredItems || []);
      entries = Object.values(defs).map((d) => ({
        id: d.id, name: d.name, rarity: d.rarity,
        lore: d.lore, spriteKey: d.spriteKey,
        seen: seen.has(d.id)
      }));
    } else if (tab === 'enemies') {
      const defs = this.content.enemies || {};
      const seen = new Set(m.discoveredEnemies || []);
      entries = Object.values(defs).map((d) => ({
        id: d.id, name: d.name, rarity: 'common',
        lore: '', spriteKey: d.spriteKey, seen: seen.has(d.id)
      }));
    } else if (tab === 'biomes') {
      const defs = this.content.biomes?.biomes || [];
      const seen = new Set(m.discoveredBiomes || []);
      entries = defs.map((d) => ({
        id: d.id, name: d.name, rarity: 'rare',
        lore: d.atmosphere, spriteKey: null, seen: seen.has(d.id)
      }));
    } else if (tab === 'achieve') {
      const defs = this.content.achievements?.achievements || [];
      const unlocked = new Set(m.achievementsUnlocked || []);
      const counters = m.achievementCounters || {};
      entries = defs.map((d) => {
        const have = counters[d.trigger] || 0;
        const isDone = unlocked.has(d.id);
        const progress = isDone ? '' : ` (${Math.min(have, d.threshold)}/${d.threshold})`;
        return {
          id: d.id, name: d.name + progress, rarity: isDone ? 'legendary' : 'common',
          lore: d.description, spriteKey: null, seen: isDone
        };
      });
    }

    // Pagination — show up to ~10 entries (portrait) / 12 (landscape) per page.
    const rowH = IS_LANDSCAPE ? 28 : 36;
    const listX = g.modalX + 8;
    const listW = g.modalW - 16;
    const listH = g.closeY - g.listY - 16;
    const perPage = Math.max(1, Math.floor(listH / rowH));
    const totalPages = Math.max(1, Math.ceil(entries.length / perPage));
    if (!this._codexPage) this._codexPage = 0;
    if (this._codexPage >= totalPages) this._codexPage = totalPages - 1;
    const start = this._codexPage * perPage;
    const slice = entries.slice(start, start + perPage);

    for (let i = 0; i < slice.length; i++) {
      const e = slice[i];
      const ry = g.listY + i * rowH;
      const bg = i % 2 === 0 ? COLOR.bgPanelAlt : COLOR.bg;
      r.drawRect(listX, ry, listW, rowH, bg);

      // Icon.
      const iconSize = rowH - 6;
      const iconX = listX + 4;
      const iconY = ry + 3;
      r.drawRect(iconX, iconY, iconSize, iconSize,
        e.seen ? COLOR.bgPanel : '#000');
      if (e.seen && e.spriteKey && r.sprites) {
        r.sprites.draw(e.spriteKey, r.ctx, iconX, iconY, { size: iconSize });
      } else if (!e.seen) {
        r.drawText('?', iconX + iconSize / 2, iconY + iconSize / 2,
          { size: 16, bold: true, align: 'center', baseline: 'middle',
            family: FONT_DISPLAY, color: COLOR.textMuted });
      }

      // Name + lore (or '???' if unseen).
      const tx = iconX + iconSize + 8;
      const name = e.seen ? e.name : '???';
      const nameColor = e.seen ? rarityColor(e.rarity) : COLOR.textMuted;
      r.drawText(name, tx, ry + 4,
        { size: 12, bold: true, family: FONT_DISPLAY, color: nameColor });
      if (e.seen && e.lore) {
        const lore = e.lore.length > 60 ? e.lore.slice(0, 58) + '…' : e.lore;
        r.drawText(`"${lore}"`, tx, ry + rowH - 12,
          { size: 9, italic: true, family: FONT_BODY, color: COLOR.textMuted });
      } else if (!e.seen) {
        r.drawText('not yet seen in the depths', tx, ry + rowH - 12,
          { size: 9, italic: true, family: FONT_BODY, color: COLOR.textMuted });
      }
    }

    // Pagination footer.
    if (totalPages > 1) {
      const footY = g.listY + perPage * rowH + 2;
      r.drawText(`Page ${this._codexPage + 1} / ${totalPages}`,
        CANVAS_WIDTH / 2, footY,
        { size: 10, align: 'center', family: FONT_MONO, color: COLOR.textMuted });
      // PREV/NEXT buttons.
      const btnW = 60, btnH = 24;
      const prevX = listX + 4, nextX = listX + listW - btnW - 4;
      r.drawRect(prevX, footY - 4, btnW, btnH, COLOR.bgCard);
      r.drawStrokedRect(prevX, footY - 4, btnW, btnH, COLOR.borderSoft, 1);
      r.drawText('◀ PREV', prevX + btnW / 2, footY + btnH / 2 - 4,
        { size: 9, align: 'center', baseline: 'middle', family: FONT_DISPLAY });
      r.drawRect(nextX, footY - 4, btnW, btnH, COLOR.bgCard);
      r.drawStrokedRect(nextX, footY - 4, btnW, btnH, COLOR.borderSoft, 1);
      r.drawText('NEXT ▶', nextX + btnW / 2, footY + btnH / 2 - 4,
        { size: 9, align: 'center', baseline: 'middle', family: FONT_DISPLAY });
    }
  }

  // --- Shop modal ---------------------------------------------------
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
    r.drawRect(g.modalX, g.modalY, g.modalW, g.modalH, COLOR.bgPanel);
    r.drawStrokedRect(g.modalX, g.modalY, g.modalW, g.modalH, COLOR.gold, 2);
    r.drawText('EMPORIUM', CANVAS_WIDTH / 2, g.modalY + 18,
      { size: 18, bold: true, align: 'center', family: FONT_DISPLAY, color: COLOR.gold });
    r.drawText(`◈ ${coins} coins`, CANVAS_WIDTH / 2, g.modalY + 40,
      { size: 12, align: 'center', family: FONT_MONO, color: COLOR.textXP });
    for (let i = 0; i < upgrades.length; i++) {
      const u = upgrades[i];
      const card = g.cards[i];
      const ownedLevel = this.meta?.upgradeLevel(u.id) || 0;
      const maxed = ownedLevel >= (u.maxLevel || 1);
      const cost = TitleScreen._nextCost(u, ownedLevel);
      const canAfford = coins >= cost;
      r.drawRect(card.x, card.y, card.w, card.h, COLOR.bgCard);
      r.drawStrokedRect(card.x, card.y, card.w, card.h, COLOR.borderSoft, 1);
      const levelTxt = u.maxLevel > 1
        ? `  ${ownedLevel}/${u.maxLevel}`
        : (ownedLevel > 0 ? '  OWNED' : '');
      r.drawText(`${u.name}${levelTxt}`, card.x + 8, card.y + 6,
        { size: 12, bold: true, family: FONT_DISPLAY, color: COLOR.textPrimary });
      r.drawText(u.description, card.x + 8, card.y + 24,
        { size: 10, family: FONT_BODY, italic: true, color: COLOR.textMuted });
      const btnW = 72, btnH = 30;
      const btnX = card.x + card.w - btnW - 8;
      const btnY = card.y + card.h - btnH - 6;
      const bgColor = maxed ? COLOR.bgPanelAlt
                   : canAfford ? '#2e3a2a' : '#3a2e2a';
      const borderColor = maxed ? COLOR.borderSoft
                       : canAfford ? '#80c060' : '#a06060';
      r.drawRect(btnX, btnY, btnW, btnH, bgColor);
      r.drawStrokedRect(btnX, btnY, btnW, btnH, borderColor, 2);
      const label = maxed ? 'MAX' : `${cost} ◈`;
      r.drawText(label, btnX + btnW / 2, btnY + btnH / 2,
        { size: 11, bold: true, align: 'center', baseline: 'middle', family: FONT_MONO,
          color: maxed ? COLOR.textMuted : (canAfford ? '#a8ff90' : '#ff9090') });
    }
    if (this._shopFeedback && this._t < this._shopFeedbackUntil) {
      r.drawText(this._shopFeedback, CANVAS_WIDTH / 2, g.closeY - 8,
        { size: 11, italic: true, align: 'center', family: FONT_BODY, color: COLOR.textHeal });
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
    Object.assign(this.state.state.meta, this.meta.state);
  }

  // --- hit-test ------------------------------------------------------
  hitTest(x, y) {
    // Character picker handles its own raw-pointer taps — let them pass
    // through as `pointer` actions rather than packaging a buttonIndex.
    if (this.characterSelect?.open) return -1;
    // Modal-specific hit tests first.
    if (this.modal === 'shop') {
      const g = this._shopGeometry();
      const btnW = 72, btnH = 30;
      for (let i = 0; i < g.cards.length; i++) {
        const card = g.cards[i];
        const btnX = card.x + card.w - btnW - 8;
        const btnY = card.y + card.h - btnH - 6;
        if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
          return 200 + i;
        }
      }
      const closeRect = this._modalCloseRect(g.closeY);
      if (TitleScreen._inside(x, y, closeRect)) return 99;
      return -1;
    }
    if (this.modal === 'settings') {
      const diff = this._settingsDifficultyHitTest(x, y);
      if (diff) return `diff:${diff}`;
      const orient = this._settingsOrientationHitTest(x, y);
      if (orient) return orient === 'portrait' ? 300 : 301;
      const g = this._settingsGeometry();
      const closeRect = this._modalCloseRect(g.closeY);
      if (TitleScreen._inside(x, y, closeRect)) return 99;
      return -1;
    }
    if (this.modal === 'controls') {
      const g = this._controlsGeometry();
      const closeRect = this._modalCloseRect(g.closeY);
      if (TitleScreen._inside(x, y, closeRect)) return 99;
      return 98;
    }
    if (this.modal === 'codex') {
      const g = this._codexGeometry();
      // Tabs.
      const tabs = this._codexTabs();
      const tabW = (g.modalW - 16) / tabs.length;
      if (y >= g.tabY && y <= g.tabY + g.tabH) {
        for (let i = 0; i < tabs.length; i++) {
          const tx = g.modalX + 8 + i * tabW;
          if (x >= tx && x <= tx + tabW) return 400 + i; // 400+i = codex tab i
        }
      }
      // Pagination buttons.
      const listX = g.modalX + 8;
      const listW = g.modalW - 16;
      const rowH = IS_LANDSCAPE ? 28 : 36;
      const listH = g.closeY - g.listY - 16;
      const perPage = Math.floor(listH / rowH);
      const footY = g.listY + perPage * rowH + 2;
      const btnW = 60, btnH = 24;
      const prevX = listX + 4, nextX = listX + listW - btnW - 4;
      if (y >= footY - 4 && y <= footY - 4 + btnH) {
        if (x >= prevX && x <= prevX + btnW) return 410; // codex prev
        if (x >= nextX && x <= nextX + btnW) return 411; // codex next
      }
      const closeRect = this._modalCloseRect(g.closeY);
      if (TitleScreen._inside(x, y, closeRect)) return 99;
      return -1;
    }
    if (this.modal) {
      // Generic modal (meta) — close on close-button or outside tap.
      const closeRect = this._modalCloseRect();
      if (TitleScreen._inside(x, y, closeRect)) return 99;
      return 98;
    }

    // Menu rows
    const rowH = LAYOUT.rowH;
    const rowW = LAYOUT.rowW;
    const bx = (CANVAS_WIDTH - rowW) / 2;
    const menuItems = this._menuItems();
    for (let i = 0; i < menuItems.length; i++) {
      const by = LAYOUT.baseY + i * (rowH + LAYOUT.rowGap);
      if (x >= bx && x <= bx + rowW && y >= by && y <= by + rowH) return i;
    }
    return -1;
  }

  static _inside(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w &&
           y >= rect.y && y <= rect.y + rect.h;
  }

  /** Shrink title until it fits canvas width (fixes clipped "S"). */
  static _fitTitleSize(renderer, text, startSize) {
    const maxW = CANVAS_WIDTH - 28;
    let size = startSize;
    const opts = { bold: true, family: FONT_DISPLAY };
    while (size > 22 && renderer.measureText(text, { ...opts, size }) > maxW) {
      size -= 2;
    }
    return size;
  }

  /**
   * SHADOW DEPTHS rendered with an animated brass gradient that sweeps
   * left→right (matches `sd-shimmer` keyframe in iron-title-hud.jsx).
   * We achieve the gradient-on-text effect on canvas by:
   *   1. drawing the engraved back-shadow (ink + 2px offset)
   *   2. clipping to the text shape and filling with a sliding linear
   *      gradient that includes a hot bright-gold band.
   */
  _renderShimmerTitle(renderer, text, cx, y, size) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.font = `bold ${size}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const w = ctx.measureText(text).width;
    // Engraved back-shadow.
    ctx.fillStyle = IRON.ink;
    ctx.fillText(text, cx + 2, y + 2);
    // Sliding brass gradient — bright band sweeps across the glyph.
    const phase = (this._t * 0.22) % 1;
    const gx0 = cx - w / 2 - w * 0.4 + phase * w * 1.8;
    const grad = ctx.createLinearGradient(gx0, 0, gx0 + w * 0.8, 0);
    grad.addColorStop(0,     BRASS_DARK);
    grad.addColorStop(0.40,  BRASS_HI);
    grad.addColorStop(0.50,  BRASS_WHITE);
    grad.addColorStop(0.60,  BRASS_HI);
    grad.addColorStop(1,     BRASS_DARK);
    ctx.shadowColor = 'rgba(212,172,108,0.45)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = grad;
    ctx.fillText(text, cx, y);
    ctx.restore();
  }

  /** Ornamental row above title: ─── ✶ ◆ ✶ ─── */
  _renderTitleOrnament(renderer, y) {
    const ctx = renderer.ctx;
    const cx = CANVAS_WIDTH / 2;
    ctx.save();
    // Left line
    const lineG1 = ctx.createLinearGradient(cx - 90, 0, cx - 24, 0);
    lineG1.addColorStop(0, 'rgba(212,172,108,0)');
    lineG1.addColorStop(1, BRASS);
    ctx.fillStyle = lineG1;
    ctx.fillRect(cx - 90, y, 66, 1);
    // Right line
    const lineG2 = ctx.createLinearGradient(cx + 24, 0, cx + 90, 0);
    lineG2.addColorStop(0, BRASS);
    lineG2.addColorStop(1, 'rgba(212,172,108,0)');
    ctx.fillStyle = lineG2;
    ctx.fillRect(cx + 24, y, 66, 1);
    // Flickering stars + center diamond
    const flick1 = 0.7 + 0.3 * Math.sin(this._t * 2.5);
    const flick2 = 0.7 + 0.3 * Math.sin(this._t * 3.1 + 1.2);
    ctx.globalAlpha = flick1;
    renderer.drawText('✶', cx - 16, y - 6,
      { size: 13, align: 'center', color: BRASS, family: FONT_DISPLAY, bold: true });
    ctx.globalAlpha = flick2;
    renderer.drawText('✶', cx + 16, y - 6,
      { size: 13, align: 'center', color: BRASS, family: FONT_DISPLAY, bold: true });
    ctx.globalAlpha = 1;
    // Center diamond (rotated square with shadow glow)
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = BRASS;
    ctx.shadowBlur = 6;
    ctx.fillStyle = BRASS;
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
    ctx.restore();
  }

  _renderEmbers(renderer) {
    const ctx = renderer.ctx;
    ctx.save();
    for (const p of this._particles) {
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.restore();
  }

  _renderBackdrop(renderer) {
    const ctx = renderer.ctx;
    const w = CANVAS_WIDTH;
    const h = CANVAS_HEIGHT;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#221a2e');
    grad.addColorStop(0.45, '#120e18');
    grad.addColorStop(1, '#0a0810');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Side pillars / arch hints.
    renderer.drawRect(0, 0, 28, h, '#0c0a12');
    renderer.drawRect(w - 28, 0, 28, h, '#0c0a12');
    for (let y = 22; y < h - 32; y += 42) {
      renderer.drawRect(8, y, 20, 1, '#24182a');
      renderer.drawRect(w - 28, y + 18, 20, 1, '#24182a');
    }
    renderer.drawRect(0, 0, w, 3, COLOR.goldDim);
    renderer.drawRect(0, h - 4, w, 4, '#1a1420');
    // Soft vignette corners.
    ctx.save();
    ctx.globalAlpha = 0.35;
    renderer.drawRect(0, 0, w, 48, '#000');
    renderer.drawRect(0, h - 56, w, 56, '#000');
    ctx.restore();
    // Center glow behind logo.
    ctx.save();
    ctx.globalAlpha = 0.12;
    const cx = w / 2;
    const rg = ctx.createRadialGradient(cx, LAYOUT.logoY + 20, 8, cx, LAYOUT.logoY + 20, 140);
    rg.addColorStop(0, COLOR.gold);
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    this._renderDepthMural(renderer);
  }

  _renderDepthMural(renderer) {
    const ctx = renderer.ctx;
    const w = CANVAS_WIDTH;
    const h = CANVAS_HEIGHT;
    const baseY = IS_LANDSCAPE ? h - 138 : h - 316;
    const cx = w / 2;

    ctx.save();
    ctx.globalAlpha = IS_LANDSCAPE ? 0.22 : 0.34;

    // Distant ritual door.
    const doorW = IS_LANDSCAPE ? 120 : 188;
    const doorH = IS_LANDSCAPE ? 84 : 178;
    const doorX = cx - doorW / 2;
    const doorY = baseY + (IS_LANDSCAPE ? 18 : 28);
    const doorGrad = ctx.createLinearGradient(0, doorY, 0, doorY + doorH);
    doorGrad.addColorStop(0, '#2a2030');
    doorGrad.addColorStop(0.55, '#100b18');
    doorGrad.addColorStop(1, '#050408');
    ctx.fillStyle = doorGrad;
    ctx.fillRect(doorX, doorY + 22, doorW, doorH - 22);
    ctx.beginPath();
    ctx.arc(cx, doorY + 24, doorW / 2, Math.PI, 0);
    ctx.lineTo(doorX + doorW, doorY + 36);
    ctx.lineTo(doorX, doorY + 36);
    ctx.closePath();
    ctx.fill();
    renderer.drawStrokedRect(doorX, doorY + 26, doorW, doorH - 26, '#4a3a50', 1);

    // Glowing seal.
    ctx.globalAlpha = IS_LANDSCAPE ? 0.28 : 0.42;
    ctx.strokeStyle = COLOR.goldDim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, doorY + doorH * 0.48, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, doorY + doorH * 0.48 - 22);
    ctx.lineTo(cx + 22, doorY + doorH * 0.48);
    ctx.lineTo(cx, doorY + doorH * 0.48 + 22);
    ctx.lineTo(cx - 22, doorY + doorH * 0.48);
    ctx.closePath();
    ctx.stroke();

    // Descending steps toward the player.
    ctx.globalAlpha = IS_LANDSCAPE ? 0.18 : 0.3;
    for (let i = 0; i < 7; i++) {
      const stepW = 52 + i * 34;
      const stepY = doorY + doorH - 12 + i * 18;
      renderer.drawRect(cx - stepW / 2, stepY, stepW, 4, i % 2 ? '#1a1220' : '#2a2030');
      renderer.drawRect(cx - stepW / 2, stepY + 4, stepW, 1, '#5a4830');
    }

    // Low mist drifting across the empty lower viewport.
    ctx.globalAlpha = IS_LANDSCAPE ? 0.08 : 0.16;
    const t = this._t;
    for (let i = 0; i < 5; i++) {
      const mistW = 96 + i * 28;
      const mx = ((t * (10 + i * 3) + i * 91) % (w + mistW)) - mistW;
      const my = h - 214 + i * 25 + Math.sin(t * 0.8 + i) * 4;
      renderer.drawRect(mx, my, mistW, 2, i % 2 ? '#d4be7a28' : '#ffffff18');
      renderer.drawRect(mx + 24, my + 8, mistW * 0.55, 1, '#6a608030');
    }

    // Foreground candle sparks.
    ctx.globalAlpha = 0.44;
    for (let i = 0; i < 9; i++) {
      const sx = 62 + i * 44;
      const sy = h - 86 - (i % 3) * 11;
      const flicker = Math.sin(t * 7 + i) * 2;
      renderer.drawRect(sx - 1, sy + 8, 2, 18, '#4a3424');
      renderer.drawRect(sx - 3, sy + 5, 6, 4, '#2a1a14');
      renderer.drawRect(sx - 1, sy + flicker, 2, 8, COLOR.goldHi);
      renderer.drawRect(sx, sy + 5 + flicker, 1, 4, '#e85a4a');
    }
    ctx.restore();
  }

  static _seedParticles() {
    const arr = [];
    const tints = [BRASS_HI, BRASS, '#ff8844'];
    for (let i = 0; i < 18; i++) {
      const duration = 5 + Math.random() * 4;
      arr.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        vy: 22 + Math.random() * 26,
        size: 1 + Math.floor(Math.random() * 2),
        peak: 0.5 + Math.random() * 0.4,
        alpha: 0,
        color: tints[i % tints.length],
        life: Math.random() * duration,
        duration,
        phase: Math.random() * Math.PI * 2
      });
    }
    return arr;
  }
}

function rarityColor(r) {
  switch (r) {
    case 'uncommon': return COLOR.itemUncommon;
    case 'rare':     return COLOR.itemRare;
    case 'epic':     return COLOR.itemEpic;
    default:         return COLOR.itemCommon;
  }
}
