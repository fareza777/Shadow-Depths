/**
 * HUD — top-left stats, top-center floor name, bottom message log + hotkey
 * bar. Drawn by the Renderer's primitives. No DOM nodes (everything in
 * canvas) so it scales with the game viewport.
 */
import { COLOR, TILE_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config/constants.js';

export class HUD {
  /**
   * @param {{ messageLog:object }} deps
   */
  constructor({ messageLog }) {
    this.messageLog = messageLog;
  }

  /**
   * @param {import('../rendering/Renderer.js').Renderer} renderer
   * @param {{ player:object, floor:object, floorIndex:number, totalFloors:number }} ctx
   */
  render(renderer, ctx) {
    const { player, floor, floorIndex, totalFloors } = ctx;
    this._drawStats(renderer, player);
    this._drawFloorBanner(renderer, floor, floorIndex, totalFloors);
    this._drawHotkeyBar(renderer, player);
    this._drawMessages(renderer);
  }

  // --- panels ---------------------------------------------------------
  _drawStats(r, p) {
    const x = 8, y = 8;
    // HP bar
    r.drawBar(x, y, 180, 14, p.stats.hp, p.stats.hpMax, COLOR.hpBar, COLOR.hpBarBg);
    r.drawText(`HP ${p.stats.hp}/${p.stats.hpMax}`, x + 6, y + 1, { size: 12, bold: true });
    // XP bar
    const xpNeed = p.xpToNext();
    r.drawBar(x, y + 18, 180, 8, p.xp, xpNeed, COLOR.xpBar, COLOR.xpBarBg);
    r.drawText(`Lv ${p.level} — ${p.xp}/${xpNeed}`, x + 6, y + 18, { size: 9, bold: true });

    // Stat line
    const atk = p.totalAtk();
    const def = p.totalDef();
    const crit = Math.round(p.critChance() * 100);
    r.drawText(`ATK ${atk}  DEF ${def}  DEX ${p.stats.dex}  CRIT ${crit}%`, x, y + 32,
      { size: 11, color: COLOR.textMuted });
    r.drawText(`Gold ${p.gold}`, x, y + 46, { size: 11, color: COLOR.textXP });

    // Status effect chips
    let chipX = x;
    const chipY = y + 62;
    for (const eff of p.statusEffects) {
      const label = `${eff.id} ${eff.value}×${eff.duration}`;
      const w = 10 + label.length * 6;
      r.drawRect(chipX, chipY, w, 14, eff.id === 'poison' ? '#2a4a30' : (eff.id === 'atk_buff' ? '#4a2a20' : '#1e3a52'));
      r.drawText(label, chipX + 4, chipY + 1, { size: 10 });
      chipX += w + 4;
    }

    // Revive charm indicator
    if (p.reviveCharges > 0) {
      r.drawText(`✦ Revive ×${p.reviveCharges}`, x, chipY + 18, { size: 10, color: COLOR.textHeal });
    }
  }

  _drawFloorBanner(r, floor, idx, total) {
    if (!floor) return;
    const cx = CANVAS_WIDTH / 2;
    r.drawText(`${floor.definition.name}`, cx, 10, { size: 14, bold: true, align: 'center' });
    r.drawText(`Floor ${idx + 1} of ${total}`, cx, 28, { size: 10, align: 'center', color: COLOR.textMuted });
  }

  _drawHotkeyBar(r, p) {
    if (!p.inventory) return;
    const slotSize = 36;
    const padding = 4;
    const total = p.inventory.size * (slotSize + padding) - padding;
    const startX = (CANVAS_WIDTH - total) / 2;
    const y = CANVAS_HEIGHT - slotSize - 8;
    for (let i = 0; i < p.inventory.size; i++) {
      const x = startX + i * (slotSize + padding);
      r.drawRect(x, y, slotSize, slotSize, '#16141c');
      r.drawStrokedRect(x, y, slotSize, slotSize, '#3a3340', 1);
      r.drawText(String(i + 1), x + 2, y + 1, { size: 9, color: COLOR.textMuted });
      const item = p.inventory.getSlot(i);
      if (item) {
        // Use SpriteRegistry for the icon; ctx is on the renderer.
        r.sprites.draw(item.spriteKey, r.ctx, x + 6, y + 6, { size: slotSize - 12 });
        if (item.stackable && item.count > 1) {
          r.drawText(`×${item.count}`, x + slotSize - 18, y + slotSize - 12, { size: 9 });
        }
      }
    }
    // Equipped slots
    const eqY = y - 26;
    r.drawText(`Wpn: ${p.weapon?.name || '—'}`, startX, eqY, { size: 10, color: COLOR.textMuted });
    r.drawText(`Arm: ${p.armor?.name || '—'}`, startX + 220, eqY, { size: 10, color: COLOR.textMuted });
  }

  _drawMessages(r) {
    if (!this.messageLog) return;
    const lines = this.messageLog.recent(3);
    const baseY = CANVAS_HEIGHT - 96;
    for (let i = 0; i < lines.length; i++) {
      r.drawText(lines[i].text, 8, baseY + i * 14, { size: 11, color: lines[i].color });
    }
  }
}
