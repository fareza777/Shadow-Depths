/**
 * DialogueSystem — stub. Ready for v0.5 narrative pass.
 *
 * v0.1 has no NPCs and no dialogue is started at runtime. This file exists
 * so the API shape is fixed now: when v0.5 writes dialog trees in
 * `data/dialogue.json`, the consumer code (NPC interaction → showing a
 * modal → emitting choice events) is already wired into the bus.
 *
 * The brief tree format:
 *   {
 *     "npc_id": {
 *       "start": {
 *         "text": "...",
 *         "options": [ { "text": "...", "next": "node_id" }, ... ]
 *       },
 *       "node_id": { ... }
 *     }
 *   }
 */
import { LOG } from '../config/constants.js';

export class DialogueSystem {
  /**
   * @param {{ bus:object, trees?:object }} deps
   */
  constructor({ bus, trees = {} }) {
    this.bus = bus;
    this._trees = trees;
    /** @type {{ npcId:string, node:string }|null} */
    this.active = null;
  }

  registerTree(npcId, tree) {
    this._trees[npcId] = tree;
  }

  /**
   * Begin a conversation. Emits 'dialogue:opened' for the UI to render.
   * v0.1 only logs because no UI listens yet.
   */
  start(npcId) {
    const tree = this._trees[npcId];
    if (!tree) {
      console.warn(LOG.UI, `DialogueSystem: no tree for "${npcId}"`);
      return false;
    }
    this.active = { npcId, node: 'start' };
    this.bus.emit('dialogue:opened', this._currentPayload());
    return true;
  }

  choose(optionIndex) {
    if (!this.active) return false;
    const tree = this._trees[this.active.npcId];
    const node = tree?.[this.active.node];
    const opt = node?.options?.[optionIndex];
    if (!opt) return false;
    if (opt.next === 'end' || !tree[opt.next]) {
      this.end();
      return true;
    }
    this.active.node = opt.next;
    this.bus.emit('dialogue:advanced', this._currentPayload());
    return true;
  }

  end() {
    if (!this.active) return;
    const payload = this.active;
    this.active = null;
    this.bus.emit('dialogue:closed', payload);
  }

  _currentPayload() {
    if (!this.active) return null;
    const node = this._trees[this.active.npcId]?.[this.active.node];
    return { npcId: this.active.npcId, node: this.active.node, ...node };
  }
}
