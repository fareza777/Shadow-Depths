/**
 * VigilScreen — full-canvas character sheet, modeled on the mock.
 *
 * Sections, top to bottom:
 *   1. Header: "THE LAST VIGIL" + character name (Fajar) + LV + XP bar.
 *   2. Portrait (large player sprite drawn at 4×).
 *   3. Big HP bar with numeric.
 *   4. Stat grid: ATTACK · DEFENSE · DEXTERITY · CRIT · LIFESTEAL · TORCH.
 *   5. Boons & Afflictions chip row (active status effects).
 *   6. Equipment card list — one card per slot (Weapon, Helm, Armor, Ring).
 *      Each card has the piece name, stats, lore, and UNEQUIP button.
 *
 * Opened from in-game via a new "VIGIL" tap on the inventory action row
 * or a button on the HUD. Not a standalone scene — it's a canvas modal
 * managed by GameScene, like InventoryUI.
 */
import {
  COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE,
  FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize
} from '../config/constants.js';

const HERO_NAME = 'FAJAR';
const HERO_TITLE = 'THE LAST VIGIL';

export class VigilScreen {
  /** @param {{ bus: object }} deps */
  constructor({ bus }) {
    this.bus = bus;
    this.open = false;
  }

  show() { this.open = true; }
  hide() { this.open = false; }
  toggle() { this.open = !this.open; }

  /**
   * @param {import('../entities/Player.js').Player} player
   * @param {{ type:string, dx?:number, dy?:number, index?:number }} input
   */
  handleInput(player, input) {
    if (!this.open) return false;
    if (input.type === 'vigil' || input.type === 'inventory' || input.type === 'escape') {
      this.hide();
      return true;
    }
    return true; // swallow all other input while open
  }

  /**
   * Canvas tap. Tap a card's UNEQUIP button to unequip that slot, or
   * tap CLOSE to dismiss the modal.
   */
  handleCanvasTap(canvasX, canvasY, player) {
    if (!this.open) return false;
    // Equipment card UNEQUIP buttons.
    const cards = this._equipmentCards(player);
    for (const c of cards) {
      if (!c.item) continue;
      const btn = c.unequipBtn;
      if (canvasX >= btn.x && canvasX <= btn.x + btn.w &&
          canvasY >= btn.y && canvasY <= btn.y + btn.h) {
        this.bus.emit('command:unequip', { slot: c.slot });
        return true;
      }
    }
    // Close button.
    const close = this._closeRect();
    if (canvasX >= close.x && canvasX <= close.x + close.w &&
        canvasY >= close.y && canvasY <= close.y + close.h) {
      this.hide();
      return true;
    }
    return true;
  }

  // --- layout helpers -----------------------------------------------
  _closeRect() {
    const w = IS_LANDSCAPE ? 140 : 180;
    const h = IS_LANDSCAPE ? 40  : 48;
    return {
      x: (CANVAS_WIDTH - w) / 2,
      y: CANVAS_HEIGHT - h - 12,
      w, h
    };
  }

  /**
   * Compute card geometry for each equipment slot. Returns objects with
   * { slot, item, x, y, w, h, unequipBtn }.
   */
  _equipmentCards(player) {
    const slots = [
      { slot: 'weapon', label: 'WEAPON',  item: player.weapon },
      { slot: 'helm',   label: 'HELM',    item: player.helm },
      { slot: 'armor',  label: 'ARMOR',   item: player.armor },
      { slot: 'ring',   label: 'RING',    item: player.ring }
    ];
    const cardH = IS_LANDSCAPE ? 52 : 60;
    const cardGap = 6;
    const cardW = CANVAS_WIDTH - 32;
    const cardX = 16;
    const cardsBaseY = this._cardsBaseY();
    for (let i = 0; i < slots.length; i++) {
      const y = cardsBaseY + i * (cardH + cardGap);
      const btnW = 80, btnH = 28;
      slots[i].x = cardX;
      slots[i].y = y;
      slots[i].w = cardW;
      slots[i].h = cardH;
      slots[i].unequipBtn = {
        x: cardX + cardW - btnW - 8,
        y: y + (cardH - btnH) / 2,
        w: btnW, h: btnH
      };
    }
    return slots;
  }

  /** Top Y of the first equipment card. Depends on what's above. */
  _cardsBaseY() {
    // Portrait: stat block ends ~y434; equipment starts below with gap.
    return IS_LANDSCAPE ? 210 : 468;
  }

  // --- render --------------------------------------------------------
  render(renderer, player) {
    if (!this.open) return;

    // Backdrop (warm dark, not pure black per user feedback).
    renderer.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, COLOR.bg);

    if (IS_LANDSCAPE) this._renderLandscape(renderer, player);
    else              this._renderPortrait(renderer, player);

    // Close button (anchored to canvas bottom in both layouts).
    const close = this._closeRect();
    renderer.drawRect(close.x, close.y, close.w, close.h, COLOR.bgCard);
    renderer.drawStrokedRect(close.x, close.y, close.w, close.h, COLOR.gold, 2);
    renderer.drawText('CLOSE', close.x + close.w / 2, close.y + close.h / 2,
      { size: uiSize(15), bold: true, align: 'center', baseline: 'middle',
        family: FONT_DISPLAY, color: COLOR.textPrimary });
  }

  // ---- PORTRAIT layout ----------------------------------------------
  _renderPortrait(r, p) {
    // 1. Header bar.
    r.drawRect(0, 0, CANVAS_WIDTH, 30, COLOR.bgPanel);
    r.drawText('◀ THE VIGIL', 12, 15,
      { size: uiSize(13), align: 'left', baseline: 'middle', family: FONT_DISPLAY, color: COLOR.gold });
    r.drawText('RUN', CANVAS_WIDTH - 12, 15,
      { size: uiSize(12), align: 'right', baseline: 'middle', family: FONT_MONO, color: COLOR.textMuted });

    r.drawText(HERO_TITLE, CANVAS_WIDTH / 2, 50,
      { size: uiSize(13), align: 'center', family: FONT_BODY, italic: true, color: COLOR.textMuted });
    r.drawText(HERO_NAME, CANVAS_WIDTH / 2, 76,
      { size: uiSize(30), bold: true, align: 'center', family: FONT_DISPLAY, color: COLOR.gold });
    r.drawText('"he carries other names. too late."',
      CANVAS_WIDTH / 2, 108,
      { size: uiSize(12), italic: true, align: 'center', family: FONT_BODY, color: COLOR.textMuted });

    // 3. Level + XP bar.
    const xpNeed = p.xpToNext();
    const lvY = 124;
    r.drawText(`LV.${p.level}`, 16, lvY,
      { size: uiSize(17), bold: true, family: FONT_DISPLAY, color: COLOR.gold });
    r.drawText(`XP ${p.xp} / ${xpNeed}`, CANVAS_WIDTH - 16, lvY + 2,
      { size: uiSize(12), align: 'right', family: FONT_MONO, color: COLOR.textMuted });
    r.drawBar(16, lvY + 22, CANVAS_WIDTH - 32, 6, p.xp, xpNeed, COLOR.xpBar, COLOR.xpBarBg);

    // 4. Portrait area (large player sprite scaled up).
    const portraitY = 160;
    const portraitSize = 96;
    const portraitX = (CANVAS_WIDTH - portraitSize) / 2;
    r.drawRect(portraitX, portraitY, portraitSize, portraitSize, COLOR.bgCard);
    r.drawStrokedRect(portraitX, portraitY, portraitSize, portraitSize, COLOR.gold, 2);
    r.sprites.draw('portrait_hero', r.ctx, portraitX, portraitY, { size: portraitSize });

    // 5. HP bar.
    const hpY = 270;
    r.drawText(`HP ${p.stats.hp} / ${p.stats.hpMax}`, 16, hpY,
      { size: uiSize(14), bold: true, family: FONT_DISPLAY, color: COLOR.textPrimary });
    r.drawBar(16, hpY + 18, CANVAS_WIDTH - 32, 10, p.stats.hp, p.stats.hpMax,
      COLOR.hpBar, COLOR.hpBarBg);

    // 6. Stat block.
    this._renderStatBlock(r, p, 302);

    // 7. Equipment cards.
    this._renderEquipmentCards(r, p);
  }

  // ---- LANDSCAPE layout ----------------------------------------------
  _renderLandscape(r, p) {
    // Header bar.
    r.drawRect(0, 0, CANVAS_WIDTH, 28, COLOR.bgPanel);
    r.drawText('◀ THE VIGIL', 12, 14,
      { size: 12, align: 'left', baseline: 'middle', family: FONT_DISPLAY, color: COLOR.gold });

    // Left side: portrait + name + LV + HP.
    const portraitSize = 80;
    r.drawRect(16, 40, portraitSize, portraitSize, COLOR.bgCard);
    r.drawStrokedRect(16, 40, portraitSize, portraitSize, COLOR.gold, 2);
    r.sprites.draw(p.displaySpriteKey(), r.ctx, 16, 40, { size: portraitSize });

    r.drawText(HERO_NAME, 110, 44,
      { size: 22, bold: true, family: FONT_DISPLAY, color: COLOR.gold });
    r.drawText(`LV.${p.level}`, 110, 74,
      { size: 13, family: FONT_DISPLAY, color: COLOR.textPrimary });
    const xpNeed = p.xpToNext();
    r.drawText(`XP ${p.xp} / ${xpNeed}`, 162, 76,
      { size: 11, family: FONT_MONO, color: COLOR.textMuted });
    r.drawBar(110, 96, 200, 6, p.xp, xpNeed, COLOR.xpBar, COLOR.xpBarBg);
    r.drawText(`HP ${p.stats.hp} / ${p.stats.hpMax}`, 110, 108,
      { size: 12, bold: true, family: FONT_DISPLAY });
    r.drawBar(110, 126, 200, 8, p.stats.hp, p.stats.hpMax, COLOR.hpBar, COLOR.hpBarBg);

    // Right side of upper area: stat block.
    this._renderStatBlock(r, p, 40, 340);

    // Equipment cards at bottom.
    this._renderEquipmentCards(r, p);
  }

  // ---- shared sections ----------------------------------------------
  _renderStatBlock(r, p, baseY, startX = 16) {
    const lineH = IS_LANDSCAPE ? 20 : 24;
    const labelW = 110;
    const lines = [
      ['ATTACK',     p.totalAtk(),  ''],
      ['DEFENSE',    p.totalDef(),  ''],
      ['DEXTERITY',  p.totalDex(),  ''],
      ['CRIT CHANCE',`${Math.round(p.critChance() * 100)}%`, ''],
      ['LIFESTEAL',  `${Math.round((p.skillLifesteal + (p.weapon?.onHit?.[0]?.value || 0)) * 100)}%`, ''],
      ['TORCH',      '5 tiles',    '']
    ];
    for (let i = 0; i < lines.length; i++) {
      const [label, value] = lines[i];
      const y = baseY + i * lineH;
      r.drawText(label, startX, y,
        { size: uiSize(IS_LANDSCAPE ? 12 : 13), family: FONT_DISPLAY, color: COLOR.textMuted });
      r.drawText(String(value),
        IS_LANDSCAPE ? startX + labelW + 60 : CANVAS_WIDTH - 16, y,
        { size: uiSize(IS_LANDSCAPE ? 13 : 14), bold: true, family: FONT_MONO,
          align: IS_LANDSCAPE ? 'left' : 'right', color: COLOR.gold });
    }
    // Boons strip below stats.
    if (p.statusEffects?.length > 0 || p.reviveCharges > 0) {
      const bx0 = startX;
      const by = baseY + lines.length * lineH + 4;
      r.drawText('BOONS & AFFLICTIONS', bx0, by,
        { size: 10, family: FONT_DISPLAY, color: COLOR.textMuted });
      let chipX = bx0;
      const chipY = by + 14;
      for (const eff of (p.statusEffects || [])) {
        const label = `${eff.id} ${eff.value}×${eff.duration}t`;
        const w = 10 + label.length * 5.5;
        const bg = eff.id === 'poison' ? '#2a4a30'
                : (eff.id === 'atk_buff' ? '#4a2a20' : '#1e3a52');
        r.drawRect(chipX, chipY, w, 14, bg);
        r.drawText(label, chipX + 5, chipY + 1, { size: 9, family: FONT_MONO });
        chipX += w + 4;
      }
      if (p.reviveCharges > 0) {
        const label = `revive ×${p.reviveCharges}`;
        const w = 10 + label.length * 5.5;
        r.drawRect(chipX, chipY, w, 14, '#4a3818');
        r.drawText(label, chipX + 5, chipY + 1,
          { size: 9, family: FONT_MONO, color: COLOR.textHeal });
      }
    }
  }

  _renderEquipmentCards(r, p) {
    const cards = this._equipmentCards(p);
    // Section header.
    const headerY = this._cardsBaseY() - 22;
    r.drawText('EQUIPMENT', 16, headerY,
      { size: uiSize(13), family: FONT_DISPLAY, color: COLOR.textMuted });
    r.drawText(`${cards.filter((c) => c.item).length} / 4 equipped`,
      CANVAS_WIDTH - 16, headerY + 2,
      { size: uiSize(12), align: 'right', italic: true, family: FONT_BODY, color: COLOR.textMuted });

    for (const card of cards) {
      const sel = !!card.item;
      r.drawRect(card.x, card.y, card.w, card.h,
        sel ? COLOR.bgCard : COLOR.bgPanelAlt);
      r.drawStrokedRect(card.x, card.y, card.w, card.h,
        sel ? rarityColor(card.item.rarity) : COLOR.borderSoft, sel ? 2 : 1);

      // Slot icon — small inset on the left.
      const iconSize = card.h - 14;
      const iconX = card.x + 8;
      const iconY = card.y + 7;
      r.drawRect(iconX, iconY, iconSize, iconSize, COLOR.bgPanelAlt);
      if (card.item) {
        r.sprites.draw(card.item.spriteKey, r.ctx, iconX, iconY, { size: iconSize });
      }

      // Slot label + item name.
      const textX = iconX + iconSize + 10;
      r.drawText(card.label, textX, card.y + 6,
        { size: uiSize(11), family: FONT_DISPLAY, color: COLOR.textMuted });
      r.drawText(card.item ? card.item.name : '— empty —',
        textX, card.y + 24,
        { size: uiSize(14), bold: true, family: FONT_DISPLAY,
          color: card.item ? rarityColor(card.item.rarity) : COLOR.textMuted });
      if (card.item) {
        r.drawText(this._statLine(card.item), textX, card.y + 42,
          { size: uiSize(11), italic: true, family: FONT_BODY, color: COLOR.textMuted });
      }

      // UNEQUIP button (only for filled slots).
      if (card.item) {
        const b = card.unequipBtn;
        r.drawRect(b.x, b.y, b.w, b.h, COLOR.bgPanelAlt);
        r.drawStrokedRect(b.x, b.y, b.w, b.h, COLOR.borderSoft, 1);
        r.drawText('UNEQUIP', b.x + b.w / 2, b.y + b.h / 2,
          { size: 10, bold: true, align: 'center', baseline: 'middle',
            family: FONT_DISPLAY, color: COLOR.textPrimary });
      }
    }
  }

  _statLine(item) {
    const parts = [];
    if (item.stats?.atk)   parts.push(`+${item.stats.atk} ATK`);
    if (item.stats?.def)   parts.push(`+${item.stats.def} DEF`);
    if (item.stats?.dex)   parts.push(`${item.stats.dex >= 0 ? '+' : ''}${item.stats.dex} DEX`);
    if (item.stats?.critBonus) parts.push(`+${Math.round(item.stats.critBonus * 100)}% CRIT`);
    if (item.stats?.attackRange && item.stats.attackRange > 1) {
      parts.push(`Rng ${item.stats.attackRange}`);
    }
    if (item.stats?.hpMaxBonus) parts.push(`+${item.stats.hpMaxBonus} max HP`);
    if (item.onHit?.[0]?.type === 'lifesteal') {
      parts.push(`Lifesteal ${Math.round(item.onHit[0].value * 100)}%`);
    }
    return parts.join('   ') || (item.type || '');
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
