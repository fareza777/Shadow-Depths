/**
 * SkillPickerUI — modal that pops up on level-up. Player picks 1 of 3
 * randomly-drawn skills.
 *
 * Queueing: a single Tome of Wisdom can trigger multiple level-ups at
 * once. Each level pushes one "pending pick" — the modal stays open and
 * cycles through them until the queue empties.
 */
import { COLOR, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config/constants.js';
import { RNG } from '../core/RNG.js';
import { computeSynergyMods, skillsById } from '../gameplay/skillSynergy.js';

const CARD_W = 360;
const CARD_H = 76;
const CARD_GAP = 12;
const MODAL_TITLE_Y = 80;
const FIRST_CARD_Y = 200;

export class SkillPickerUI {
  /**
   * @param {{ bus: object, content: object, rng: object }} deps
   *   content.skills.skills = the pool. rng = RunRNG fork.
   */
  constructor({ bus, content, rng }) {
    this.bus = bus;
    this.content = content;
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
  }

  /** Touch / mouse tap — tap anywhere picks (card hit = that card). */
  handleCanvasTap(x, y) {
    if (!this.open) return false;
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
      case 'move':
      case 'wait':
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
    // Pick 3 (or fewer if availability < 3).
    const shuffled = this.rng.shuffle(available);
    this.choices = shuffled.slice(0, Math.min(3, shuffled.length));
    this.open = true;
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
    renderer.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 'rgba(0,0,0,0.92)');

    renderer.drawText('LEVEL UP', CANVAS_WIDTH / 2, 50,
      { size: 26, bold: true, align: 'center', color: '#d6c87a' });
    const qLabel = this.pending > 1
      ? `Choose a skill  (${this.pending} picks remaining)`
      : 'Choose a skill';
    renderer.drawText(qLabel, CANVAS_WIDTH / 2, MODAL_TITLE_Y,
      { size: 13, align: 'center', color: COLOR.textMuted });

    const cx = (CANVAS_WIDTH - CARD_W) / 2;
    for (let i = 0; i < this.choices.length; i++) {
      const skill = this.choices[i];
      const cy = FIRST_CARD_Y + i * (CARD_H + CARD_GAP);
      const accent = rarityColor(skill.rarity);
      renderer.drawRect(cx, cy, CARD_W, CARD_H, '#16141c');
      renderer.drawStrokedRect(cx, cy, CARD_W, CARD_H, accent, 2);
      renderer.drawText(skill.name, cx + 14, cy + 14,
        { size: 16, bold: true, color: accent });
      renderer.drawText(skill.description, cx + 14, cy + 38,
        { size: 12, color: COLOR.textPrimary });
      renderer.drawText(skill.rarity, cx + CARD_W - 14, cy + 14,
        { size: 10, align: 'right', color: COLOR.textMuted });
      // Tap hint
      renderer.drawText(`tap to choose  ·  hotkey ${i + 1}`, cx + 14, cy + 56,
        { size: 10, color: COLOR.textMuted });
    }
  }
}

function rarityColor(r) {
  switch (r) {
    case 'rare':    return '#5a8ed8';
    case 'uncommon':return '#5ac06a';
    case 'epic':    return '#b070d8';
    default:        return '#c0c0c8';
  }
}
