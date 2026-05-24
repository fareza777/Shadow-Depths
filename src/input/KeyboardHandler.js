/**
 * KeyboardHandler — keydown → semantic input action.
 *
 * Mapping driven by KEYBIND in constants.js so tomorrow's rebind UI can edit
 * the same source of truth.
 */
import { KEYBIND } from '../config/constants.js';

export class KeyboardHandler {
  /**
   * @param {{ bus:object }} deps
   */
  constructor({ bus }) {
    this.bus = bus;
    this._onKey = this._onKey.bind(this);
    window.addEventListener('keydown', this._onKey);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKey);
  }

  _onKey(ev) {
    if (ev.repeat) return;
    const key = ev.key;
    const action = this._mapKey(key);
    if (!action) return;
    ev.preventDefault();
    this.bus.emit('input:action', action);
  }

  _mapKey(key) {
    if (KEYBIND.moveUp.includes(key))    return { type: 'move', dx: 0, dy: -1 };
    if (KEYBIND.moveDown.includes(key))  return { type: 'move', dx: 0, dy: 1 };
    if (KEYBIND.moveLeft.includes(key))  return { type: 'move', dx: -1, dy: 0 };
    if (KEYBIND.moveRight.includes(key)) return { type: 'move', dx: 1, dy: 0 };
    if (KEYBIND.wait.includes(key))      return { type: 'wait' };
    if (KEYBIND.pickup.includes(key))    return { type: 'pickup' };
    if (KEYBIND.descend.includes(key))   return { type: 'descend' };
    if (KEYBIND.inventory.includes(key)) return { type: 'inventory' };
    if (KEYBIND.minimap.includes(key))   return { type: 'minimap' };
    if (KEYBIND.escape.includes(key))    return { type: 'escape' };
    if (key === 'Enter')                 return { type: 'confirm' };
    if (key === 'd' || key === 'D')      return { type: 'drop' };
    for (let i = 1; i <= 9; i++) {
      if (KEYBIND[`hotkey${i}`].includes(key)) return { type: 'useSlot', index: i - 1 };
    }
    return null;
  }
}
