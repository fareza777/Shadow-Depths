/**
 * MessageLog — rolling buffer of recent in-world events.
 *
 * Subscribes to combat events on construction. Messages are short — never
 * longer than one line — and the renderer shows the last 3.
 *
 * Each entry: { text:string, color?:string, t:number }
 */
import { COLOR } from '../config/constants.js';

const MAX_HISTORY = 40;

export class MessageLog {
  /**
   * @param {{ bus:object }} deps
   */
  constructor({ bus }) {
    this.bus = bus;
    /** @type {{ text:string, color:string, t:number }[]} */
    this.entries = [];
    this._t = 0;
    this._wire();
  }

  _wire() {
    this.bus.on('tick', ({ time }) => { this._t = time; });

    this.bus.on('entity:attacked', ({ attacker, target, damage, isCrit, isMiss }) => {
      if (isMiss) {
        this.push(`${nameOf(attacker)} missed ${nameOf(target)}.`, COLOR.textMuted);
        return;
      }
      const verb = isCrit ? 'CRIT!' : 'hits';
      this.push(`${nameOf(attacker)} ${verb} ${nameOf(target)} for ${damage}.`,
        isCrit ? COLOR.textCrit : COLOR.textPrimary);
    });

    this.bus.on('entity:healed', ({ entity, amount }) => {
      if (amount <= 0) return;
      this.push(`${nameOf(entity)} heals +${amount}.`, COLOR.textHeal);
    });

    this.bus.on('entity:died', ({ entity, killer }) => {
      this.push(`${nameOf(entity)} falls.`, COLOR.textMuted);
      if (killer && killer.kind === 'status') {
        this.push(`...by poison.`, COLOR.textMuted);
      }
    });

    this.bus.on('entity:leveledUp', ({ entity, levels }) => {
      if (entity.kind === 'player') this.push(`You feel stronger. (Lv ${entity.level})`, COLOR.textXP);
    });

    this.bus.on('item:pickedUp', ({ item }) => {
      this.push(`You take the ${item.name}.`);
    });

    this.bus.on('item:used', ({ item, by }) => {
      if (by?.kind === 'player') this.push(`You use the ${item.name}.`);
    });

    this.bus.on('inventory:full', () => this.push(`Your pack is full.`, COLOR.textMuted));

    this.bus.on('player:revived', () => this.push(`You wake again. The charm is spent.`, COLOR.textHeal));

    this.bus.on('floor:entered', ({ index, name }) =>
      this.push(`Floor ${index + 1} — ${name}`, COLOR.textPrimary));
  }

  push(text, color = COLOR.textPrimary) {
    this.entries.push({ text, color, t: this._t });
    if (this.entries.length > MAX_HISTORY) this.entries.shift();
  }

  recent(n = 3) {
    return this.entries.slice(-n);
  }

  clear() { this.entries.length = 0; }
}

function nameOf(e) {
  if (!e) return 'something';
  if (e.kind === 'player') return 'You';
  return e.name || e.id || 'it';
}
