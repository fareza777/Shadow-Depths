/**
 * SkillPickerUI — modal that pops up on level-up. Player picks 1 of 3
 * randomly-drawn skills.
 *
 * Queueing: a single Tome of Wisdom can trigger multiple level-ups at
 * once. Each level pushes one "pending pick" — the modal stays open and
 * cycles through them until the queue empties.
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, FONT_DISPLAY, FONT_BODY, uiSize
} from '../config/constants.js';
import { RNG } from '../core/RNG.js';
import { computeSynergyMods, skillsById } from '../gameplay/skillSynergy.js';
import {
  drawIronPanel, drawIronActionButton, drawIronPlate, IRON_PALETTE
} from './ironPanel.js';
import { t } from '../content/i18n.js';

const CARD_W = 360;
const CARD_H = 76;
const CARD_GAP = 12;
const MODAL_TITLE_Y = 92;
const FIRST_CARD_Y = 200;

export class SkillPickerUI {
  /**
   * @param {{ bus: object, content: object, rng: object, metaProgress?: object }} deps
   *   content.skills.skills = the pool. rng = RunRNG fork.
   */
  constructor({ bus, content, rng, metaProgress, adService = null }) {
    this.bus = bus;
    this.content = content;
    this.meta = metaProgress || null;
    /** Optional: enables the watch-an-ad reroll once free ones run out. */
    this.ads = adService;
    // Skill draws don't need to be reproducible per-seed — fresh entropy
    // each session is fine. A non-seeded RNG keeps draws varied between
    // identical-seed runs (otherwise every "seed 12345" run picks the same
    // skill at level 2, which would be boring).
    this.rng = rng || new RNG(RNG.newSeed(), 'skills');
    this.open = false;
    /** Player whose level-up triggered the picker. */
    this.player = null;
    /** Pending pick count (number of level-ups still to consume). */
    this.pending = 0;
    /** The 3 skills currently on offer. */
    this.choices = [];
    /** Free skill rerolls remaining for the current pick (1 per level-up). */
    this.rerollsLeft = 0;
    /** True while a rewarded ad is loading/playing, so taps do not stack. */
    this._adBusy = false;

    bus.on('entity:leveledUp', ({ entity, levels }) => {
      if (entity?.kind !== 'player') return;
      this.player = entity;
      this.pending += Math.max(1, levels || 1);
      if (!this.open) this._present();
    });
    bus.on('scene:switched', ({ to }) => {
      if (to !== 'game') this.hide();
    });
    bus.on('request:newRun', () => this.hide());
  }

  hide() {
    this.open = false;
    this.choices = [];
    this.pending = 0;
    this.rerollsLeft = 0;
  }

  _rerollRect() {
    const w = 160;
    const h = 36;
    return {
      x: (CANVAS_WIDTH - w) / 2,
      y: FIRST_CARD_Y + 3 * (CARD_H + CARD_GAP) + 8,
      w, h
    };
  }

  /** Touch / mouse tap — tap anywhere picks (card hit = that card). */
  handleCanvasTap(x, y) {
    if (!this.open) return false;
    const rr = this._rerollRect();
    const onReroll = x >= rr.x && x <= rr.x + rr.w && y >= rr.y && y <= rr.y + rr.h;
    if (onReroll && this.rerollsLeft > 0) {
      this._reroll();
      return true;
    }
    if (onReroll && this._canWatchForReroll()) {
      void this._rerollByAd();
      return true;
    }
    // Swallow the tap while the ad is in flight so it cannot pick a card.
    if (onReroll && this._adBusy) return true;
    for (let i = 0; i < this.choices.length; i++) {
      const cy = FIRST_CARD_Y + i * (CARD_H + CARD_GAP);
      const cx = (CANVAS_WIDTH - CARD_W) / 2;
      if (x >= cx && x <= cx + CARD_W && y >= cy && y <= cy + CARD_H) {
        this._pick(this.choices[i]);
        return true;
      }
    }
    this._pickFirstOrHide();
    return true;
  }

  /** D-pad / keys while level-up — never soft-lock; always resolve a pick. */
  handleInput(action) {
    if (!this.open) return false;
    switch (action.type) {
      case 'useSlot':
        if (typeof action.index === 'number' &&
            action.index >= 0 && action.index < this.choices.length) {
          this._pick(this.choices[action.index]);
        } else {
          this._pickFirstOrHide();
        }
        return true;
      case 'wait':
        // Wait key = free reroll once
        if (this.rerollsLeft > 0) {
          this._reroll();
          return true;
        }
        this._pickFirstOrHide();
        return true;
      case 'move':
      case 'confirm':
      case 'pickup':
      case 'menu':
      case 'escape':
        this._pickFirstOrHide();
        return true;
      default:
        return true;
    }
  }

  _pickFirstOrHide() {
    if (this.choices.length > 0) this._pick(this.choices[0]);
    else this.hide();
  }

  _present() {
    if (this.pending <= 0 || !this.player) {
      this.hide();
      return;
    }
    const pool = (this.content.skills && this.content.skills.skills) || [];
    if (pool.length === 0) {
      // No skills defined — just decrement and bail.
      this.pending = 0;
      this.hide();
      return;
    }
    // Filter out skills the player already has (no duplicates).
    const owned = new Set(this.player.skills || []);
    const available = pool.filter((s) =>
      !owned.has(s.id) && (!s.hero || s.hero === this.player.heroKind));
    if (available.length === 0) {
      // No more skills to offer ever — just absorb the level-ups.
      this.pending = 0;
      this.hide();
      return;
    }
    // Draw 3 distinct, weighted by rarity so rare/epic boons feel earned.
    this.choices = this._weightedDraw(available, 3);
    const bonus = this.meta?.upgradeLevel?.('skill_reroll_plus') || 0;
    this.rerollsLeft = 1 + bonus;
    this.open = true;
  }

  /** One free redraw of the current 3 cards without spending a pending pick. */
  _reroll() {
    if (this.rerollsLeft <= 0) return;
    if (!this._redrawChoices()) return;
    this.rerollsLeft -= 1;
    this.bus.emit('skill:rerolled', { remaining: this.rerollsLeft });
  }

  /** Redraw the 3 cards. Returns false when the pool cannot supply any. */
  _redrawChoices() {
    if (!this.player) return false;
    const pool = (this.content.skills && this.content.skills.skills) || [];
    const owned = new Set(this.player.skills || []);
    const available = pool.filter((s) =>
      !owned.has(s.id) && (!s.hero || s.hero === this.player.heroKind));
    if (available.length === 0) return false;
    this.choices = this._weightedDraw(available, 3);
    return true;
  }

  /** True when the free rerolls are gone but an ad can buy one more. */
  _canWatchForReroll() {
    return this.rerollsLeft <= 0
      && !this._adBusy
      && !!this.ads?.canOfferReroll?.();
  }

  /**
   * Trade a rewarded ad for one extra redraw. The cards only change when the
   * SDK confirms the reward, so quitting the video costs the player nothing
   * and gains them nothing.
   */
  async _rerollByAd() {
    if (!this._canWatchForReroll()) return;
    this._adBusy = true;
    try {
      const earned = await this.ads.showRewardedReroll();
      if (earned && this._redrawChoices()) {
        this.bus.emit('skill:rerolled', { remaining: this.rerollsLeft, source: 'ad' });
      }
    } catch (err) {
      console.warn('[SkillPicker] rewarded reroll failed:', err);
    } finally {
      this._adBusy = false;
    }
  }

  /** Pick `n` distinct skills weighted by rarity (rarer → less frequent). */
  _weightedDraw(pool, n) {
    const RW = { common: 100, uncommon: 42, rare: 16, epic: 6 };
    const bag = pool.map((s) => ({ value: s, weight: RW[s.rarity] ?? 50 }));
    const out = [];
    for (let i = 0; i < n && bag.length > 0; i++) {
      const pick = this.rng.weightedPick(bag);
      out.push(pick);
      const idx = bag.findIndex((b) => b.value === pick);
      if (idx >= 0) bag.splice(idx, 1);
    }
    return out;
  }

  _pick(skill) {
    if (!skill || !this.player) return;
    this.player.applySkill(skill.id, skill);
    // Recompute emergent tag synergies from the full owned set.
    const pool = (this.content.skills && this.content.skills.skills) || [];
    this.player.setSynergyMods(
      computeSynergyMods(this.player.skills, skillsById(pool)).mods
    );
    this.bus.emit('skill:chosen', { skill });
    this.pending -= 1;
    if (this.pending > 0) {
      // Another level-up queued — re-roll a fresh set.
      this._present();
    } else {
      this.hide();
    }
  }

  // --- render --------------------------------------------------------
  render(renderer) {
    if (!this.open) return;
    if (this.choices.length === 0) {
      this.hide();
      return;
    }
    const r = renderer;
    const ctx = r.ctx;
    r.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 'rgba(4, 2, 8, 0.88)');

    const panelW = Math.min(400, CANVAS_WIDTH - 28);
    const panelX = (CANVAS_WIDTH - panelW) / 2;
    const panelY = 36;
    const cardsBottom = FIRST_CARD_Y + 3 * (CARD_H + CARD_GAP);
    const panelH = Math.min(
      cardsBottom - panelY + (this.rerollsLeft > 0 ? 56 : 24),
      CANVAS_HEIGHT - panelY - 12
    );
    drawIronPanel(ctx, panelX, panelY, panelW, panelH);

    r.drawText(t('skills.level_up'), CANVAS_WIDTH / 2, panelY + 28, {
      size: uiSize(24), bold: true, align: 'center',
      family: FONT_DISPLAY, color: IRON_PALETTE.brass
    });
    const qLabel = this.pending > 1
      ? t('skills.choose_n', { n: this.pending })
      : t('skills.choose');
    r.drawText(qLabel, CANVAS_WIDTH / 2, MODAL_TITLE_Y, {
      size: uiSize(13), align: 'center',
      family: FONT_BODY, color: IRON_PALETTE.boneDim
    });

    const cx = (CANVAS_WIDTH - CARD_W) / 2;
    // Count synergy tags the player already owns, so each card can show how
    // close this pick brings them to the next fury/ward/hunt/arcane tier.
    const defsById = skillsById((this.content.skills && this.content.skills.skills) || []);
    const owned = {};
    for (const sid of this.player?.skills || []) {
      for (const tag of defsById[sid]?.tags || []) owned[tag] = (owned[tag] || 0) + 1;
    }
    for (let i = 0; i < this.choices.length; i++) {
      const skill = this.choices[i];
      const cy = FIRST_CARD_Y + i * (CARD_H + CARD_GAP);
      const accent = rarityColor(skill.rarity);
      drawIronPlate(ctx, cx, cy, CARD_W, CARD_H, { rivets: false });
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + 1, cy + 1, CARD_W - 2, CARD_H - 2);
      ctx.restore();
      // Rarity-tinted icon plate on the left, then text shifted past it.
      drawSkillIcon(r, cx + 12, cy + 18, 40, skill, accent);
      const tx = cx + 64;
      r.drawText(skill.name, tx, cy + 14, {
        size: uiSize(16), bold: true, color: accent, family: FONT_DISPLAY
      });
      r.drawText(skill.description, tx, cy + 38, {
        size: uiSize(12), color: IRON_PALETTE.bone, family: FONT_BODY
      });
      r.drawText(skill.rarity, cx + CARD_W - 14, cy + 14, {
        size: uiSize(10), align: 'right', color: IRON_PALETTE.boneDim, family: FONT_BODY
      });
      // Synergy progress chips (right side): TAG owned→next, ★ when this pick
      // reaches a synergy tier (2 or 4 of a tag).
      const tags = (skill.tags || []).filter((tg) => TAG_LABELS[tg]);
      let chipY = cy + 34;
      for (const tg of tags.slice(0, 2)) {
        const n = owned[tg] || 0;
        const next = n + 1;
        const tier = next === 2 || next === 4;
        r.drawText(`${TAG_LABELS[tg]} ${n}→${next}${tier ? ' ★' : ''}`,
          cx + CARD_W - 14, chipY, {
            size: uiSize(9), align: 'right',
            color: tier ? TAG_COLORS[tg] : IRON_PALETTE.boneDim, family: FONT_BODY
          });
        chipY += 13;
      }
      r.drawText(t('skills.tap_hint'), tx, cy + 56, {
        size: uiSize(10), color: IRON_PALETTE.boneDim, family: FONT_BODY
      });
    }
    if (this.rerollsLeft > 0 || this._adBusy || this._canWatchForReroll()) {
      const rr = this._rerollRect();
      let label;
      if (this._adBusy) label = t('skills.reroll_wait');
      else if (this.rerollsLeft > 1) label = `${t('skills.reroll')}  ·  ${this.rerollsLeft}`;
      else if (this.rerollsLeft === 1) label = t('skills.reroll');
      else label = t('skills.reroll_ad');
      drawIronActionButton(r, rr.x, rr.y, rr.w, rr.h, label, {
        accent: this.rerollsLeft > 0 ? IRON_PALETTE.brass : IRON_PALETTE.boneDim,
        fontSize: uiSize(12)
      });
    }
  }
}

export const TAG_LABELS = { fury: 'FURY', ward: 'WARD', hunt: 'HUNT', arcane: 'ARCANE' };
export const TAG_COLORS = { fury: '#ff7a5a', ward: '#6fb6ff', hunt: '#6ee08a', arcane: '#c08aff' };

function rarityColor(r) {
  switch (r) {
    case 'rare':    return '#5a8ed8';
    case 'uncommon':return '#5ac06a';
    case 'epic':    return '#b070d8';
    default:        return '#c0c0c8';
  }
}

/** Which of the four glyphs a skill shows — primary tag, else infer. */
export function iconCategory(skill) {
  const t = (skill.tags || [])[0];
  if (t === 'fury' || t === 'ward' || t === 'hunt' || t === 'arcane') return t;
  const e = skill.effect || {};
  if (e.atk || e.crit || e.lifesteal) return 'fury';
  if (e.def || e.dr || e.hpMax) return 'ward';
  if (e.magic || e.spellCDR || e.spellLifesteal || e.xp) return 'arcane';
  if (e.dex || e.range || e.torch || e.invSlots || e.regenEveryN) return 'hunt';
  const id = skill.id || '';
  if (/torch|eager|satchel/.test(id)) return 'hunt';
  return 'ward';
}

/**
 * Draw a small rarity-tinted glyph (sword / shield / arrow / tome) for a skill
 * card. Built from the renderer's rect primitive so it needs no sprite atlas.
 */
export function drawSkillIcon(r, x, y, s, skill, accent) {
  r.drawRect(x, y, s, s, '#0e0c14');
  r.drawStrokedRect(x, y, s, s, '#2a2630', 1);
  const p = (a, b, w, h, col) => r.drawRect(x + a, y + b, w, h, col);
  const steel = '#cfc2d8';
  switch (iconCategory(skill)) {
    case 'fury': // upright sword
      p(18, 4, 4, 20, steel); p(19, 2, 2, 2, '#ffffff');
      p(12, 24, 16, 3, accent); p(18, 27, 4, 7, '#6a5a3a'); p(17, 33, 6, 3, accent);
      break;
    case 'ward': // shield
      p(10, 6, 20, 16, accent); p(13, 9, 14, 9, '#0e0c14');
      p(16, 22, 8, 5, accent); p(18, 27, 4, 3, accent); p(18, 12, 4, 4, accent);
      break;
    case 'hunt': // arrow up-right
      p(8, 30, 4, 4, accent); p(12, 26, 4, 4, accent); p(16, 22, 4, 4, accent);
      p(20, 18, 4, 4, accent); p(24, 14, 4, 4, accent);
      p(28, 8, 6, 6, accent); p(26, 11, 3, 3, accent); p(6, 30, 4, 4, '#7a6e54');
      break;
    default: // arcane → tome
      p(9, 8, 22, 22, accent); p(11, 10, 18, 18, '#e8e0d0'); p(19, 8, 2, 22, '#0e0c14');
      p(14, 15, 3, 3, accent); p(22, 15, 3, 3, accent); p(15, 22, 9, 2, accent);
      break;
  }
}
