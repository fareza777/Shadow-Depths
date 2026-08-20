import { describe, it, expect } from 'vitest';
import { SpriteRegistry } from '../src/rendering/SpriteRegistry.js';

describe('SpriteRegistry startup rasterisation', () => {
  it('does not preload trap artwork that the lean floor renderer never draws', () => {
    const requestedSvg = [];
    const OriginalImage = globalThis.Image;

    class RecordingImage {
      set src(value) {
        requestedSvg.push(decodeURIComponent(value.split(',')[1] || ''));
      }
    }

    globalThis.Image = RecordingImage;
    try {
      new SpriteRegistry();
    } finally {
      if (OriginalImage === undefined) delete globalThis.Image;
      else globalThis.Image = OriginalImage;
    }

    expect(requestedSvg.length).toBeGreaterThan(0);
    expect(requestedSvg.some((svg) =>
      svg.includes('<ellipse cx="16" cy="29" rx="10.5" ry="2.2"')
    )).toBe(false);
  });
});
