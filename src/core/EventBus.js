/**
 * Minimal pub/sub. Used by every system to stay decoupled.
 *
 * Design notes:
 * - Synchronous dispatch. Turn-based game; ordering matters and async would
 *   create subtle bugs around turn boundaries.
 * - Handler errors are caught and logged so one bad subscriber cannot kill
 *   the event chain. Failures during render/combat would otherwise soft-lock
 *   the game.
 * - `once()` returns an unsubscribe function for convenience.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._handlers = new Map();
  }

  /**
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void} unsubscribe
   */
  on(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`EventBus.on: handler for "${event}" must be function`);
    }
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe for exactly one emission.
   * @returns {() => void} unsubscribe
   */
  once(event, handler) {
    const wrap = (payload) => {
      this.off(event, wrap);
      handler(payload);
    };
    return this.on(event, wrap);
  }

  /**
   * @param {string} event
   * @param {Function} [handler] if omitted, removes all handlers for the event
   */
  off(event, handler) {
    const set = this._handlers.get(event);
    if (!set) return;
    if (handler) {
      set.delete(handler);
      if (set.size === 0) this._handlers.delete(event);
    } else {
      this._handlers.delete(event);
    }
  }

  /**
   * @param {string} event
   * @param {*} [payload]
   */
  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set || set.size === 0) return;
    // Snapshot — handlers may unsubscribe themselves mid-iteration.
    const snapshot = Array.from(set);
    for (const handler of snapshot) {
      try {
        handler(payload);
      } catch (err) {
        // Never let one subscriber break the dispatch chain.
        console.error('[EventBus]', `handler for "${event}" threw:`, err);
      }
    }
  }

  clear() {
    this._handlers.clear();
  }
}
