/**
 * InputManager — owns input handlers, forwards semantic actions to the
 * active scene.
 *
 * Subscribes to `input:action` on the bus; the keyboard / touch handlers
 * publish to that channel, and the active scene's `handleInput` consumes.
 *
 * This indirection means a future replay/AI driver can also emit
 * `input:action` with no other changes.
 */
import { LOG } from '../config/constants.js';
import { KeyboardHandler } from './KeyboardHandler.js';
import { TouchHandler } from './TouchHandler.js';

export class InputManager {
  /**
   * @param {{ bus:object, sceneManager:object, canvas:HTMLCanvasElement }} deps
   */
  constructor({ bus, sceneManager, canvas }) {
    this.bus = bus;
    this.scenes = sceneManager;
    this.canvas = canvas;
    this.keyboard = new KeyboardHandler({ bus });
    this.touch = new TouchHandler({ bus, canvas, sceneManager });

    bus.on('input:action', (action) => {
      try {
        this.scenes.handleInput(action);
      } catch (err) {
        console.error(LOG.INPUT, 'scene handleInput threw:', err);
      }
    });
  }

  destroy() {
    this.keyboard.destroy();
    this.touch.destroy();
  }
}
