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
  constructor({ bus, state, content, metaProgress }) {
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
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      if (p.y > CANVAS_HEIGHT) p.y = -4;
      if (p.x < 0) p.x = CANVAS_WIDTH;
      if (p.x > CANVAS_WIDTH) p.x = 0;
    }
  }

  render(renderer) {
    this._renderBackdrop(renderer);

    for (const p of this._particles) {
      const ctx = renderer.ctx;
      ctx.globalAlpha = p.alpha;
      renderer.drawRect(p.x, p.y, p.size, p.size, p.color);
      ctx.globalAlpha = 1;
    }

    const titleSize = TitleScreen._fitTitleSize(renderer, 'SHADOW DEPTHS', uiSize(LAYOUT.logoSize));
    renderer.drawText('SHADOW DEPTHS', CANVAS_WIDTH / 2, LAYOUT.logoY,
      { size: titleSize, bold: true, align: 'center', family: FONT_DISPLAY, color: COLOR.gold });
    renderer.drawText('✦  ·  ✦', CANVAS_WIDTH / 2, LAYOUT.ornY,
      { size: uiSize(16), align: 'center', color: COLOR.goldDim, family: FONT_DISPLAY });
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
    this._renderMenuRows(renderer);

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

  _renderMenuRows(r) {
    const rowH = LAYOUT.rowH;
    const rowW = LAYOUT.rowW;
    const x = (CANVAS_WIDTH - rowW) / 2;
    for (let i = 0; i < MENU.length; i++) {
      const item = MENU[i];
      const y = LAYOUT.baseY + i * (rowH + LAYOUT.rowGap);
      const selected = i === this.selected;
      // Card background.
      r.drawRect(x, y, rowW, rowH, selected ? COLOR.bgCardHi : COLOR.bgCard);
      // Subtle gold left edge accent on selected row.
      if (selected) {
        r.drawRect(x, y, 3, rowH, COLOR.gold);
      }
      r.drawStrokedRect(x, y, rowW, rowH,
        selected ? COLOR.gold : COLOR.borderSoft, selected ? 2 : 1);

      const iconCx = x + 32;
      r.drawRect(x + 10, y + 8, 44, rowH - 16, selected ? COLOR.bgPanelAlt : COLOR.bgPanel);
      r.drawText(item.icon, iconCx, y + rowH / 2,
        { size: uiSize(20), bold: true, align: 'center', baseline: 'middle',
          family: FONT_DISPLAY, color: selected ? COLOR.goldHi : COLOR.gold });
      r.drawText(item.label, x + 62, y + rowH / 2,
        { size: uiSize(16), bold: true, align: 'left', baseline: 'middle',
          family: FONT_DISPLAY, color: COLOR.textPrimary });
      const sub = this._statusFor(item);
      if (sub) {
        r.drawText(sub, x + rowW - 12, y + rowH / 2,
          { size: uiSize(12), italic: true, align: 'right', baseline: 'middle',
            family: FONT_BODY, color: COLOR.textMuted });
      }
    }
  }

  /** Dynamic status text per row. */
  _statusFor(item) {
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
        if (action.dy === -1) this.selected = (this.selected + MENU.length - 1) % MENU.length;
        else if (action.dy === 1) this.selected = (this.selected + 1) % MENU.length;
        break;
      case 'confirm':
        this._activate(MENU[this.selected].id);
        break;
      case 'tap':
        if (typeof action.buttonIndex === 'number' &&
            action.buttonIndex >= 0 && action.buttonIndex < MENU.length) {
          this.selected = action.buttonIndex;
          this._activate(MENU[action.buttonIndex].id);
        }
        break;
    }
  }

  _activate(id) {
    if (id === 'newRun') this.bus.emit('request:newRun', {});
    else if (id === 'daily') {
      const seed = TitleScreen.dailySeed();
      this.bus.emit('request:newRun', { seed, mode: 'daily' });
    }
    else if (id === 'shop') this.modal = 'shop';
    else if (id === 'codex') this.modal = 'codex';
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
      : (IS_LANDSCAPE ? CANVAS_HEIGHT - 56 : CANVAS_HEIGHT - 120);
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
    const g = this._settingsGeometry();
    r.drawRect(g.modalX, g.modalY, g.modalW, g.modalH, COLOR.bgPanel);
    r.drawStrokedRect(g.modalX, g.modalY, g.modalW, g.modalH, COLOR.gold, 1);
    r.drawText('SETTINGS', CANVAS_WIDTH / 2, g.modalY + 22,
      { size: 18, bold: true, align: 'center', family: FONT_DISPLAY, color: COLOR.gold });
    r.drawText(`Volume: ${vol}%`, CANVAS_WIDTH / 2, g.modalY + 52,
      { size: 13, align: 'center', family: FONT_BODY });
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
    const lineSpacing = IS_LANDSCAPE ? 22 : 30;
    const closeH = IS_LANDSCAPE ? 40 : 48;
    const closeMargin = 14;
    const contentH = lines.length * lineSpacing + 70;
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
    const closeY = modalY + modalH - closeH - closeMargin;
    this._renderModalCloseButton(r, closeY);
  }

  // --- Codex modal --------------------------------------------------
  _codexGeometry() {
    const modalX = 12;
    const modalY = 16;
    const modalW = CANVAS_WIDTH - 24;
    const modalH = CANVAS_HEIGHT - 32;
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
    return [
      { id: 'items',   label: 'ITEMS',   count: `${seen}/${allItems}` },
      { id: 'enemies', label: 'HORRORS', count: `${seenE}/${allE}` },
      { id: 'biomes',  label: 'BIOMES',  count: `${seenB}/${allB}` }
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
    }

    // Pagination — show up to ~10 entries (portrait) / 12 (landscape) per page.
    const rowH = IS_LANDSCAPE ? 28 : 36;
    const listX = g.modalX + 8;
    const listW = g.modalW - 16;
    const listH = g.closeY - g.listY - 16;
    const perPage = Math.floor(listH / rowH);
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
      if (e.seen && e.spriteKey) {
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
    for (let i = 0; i < MENU.length; i++) {
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
  }

  static _seedParticles() {
    const arr = [];
    for (let i = 0; i < 30; i++) {
      arr.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        vx: (Math.random() - 0.5) * 4,
        vy: 3 + Math.random() * 8,
        size: 1 + Math.floor(Math.random() * 2),
        alpha: 0.2 + Math.random() * 0.4,
        color: ['#3a2c20', '#2a2438', '#1c1a28'][Math.floor(Math.random() * 3)]
      });
    }
    return arr;
  }
}
