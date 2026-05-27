# Shadow Depths — Brand Spec (Gritty Edition)

## Visual Identity
Shadow Depths is a dark fantasy roguelike. The visual style is **Gritty Pixel Art** with high contrast, deep shadows, and glowing magical elements. It avoids "clean" or "cute" aesthetics in favor of weathered textures and menacing silhouettes.

## Palette (OKLch)
The palette is centered around deep voids and ashen tones, punctuated by "soul-light" and "blood-rust" accents.

```css
:root {
  /* Foundations */
  --bg:      oklch(10% 0.02 260);    /* #050508 - Deepest Void */
  --surface: oklch(16% 0.03 260);    /* #121218 - Dark Slate */
  --fg:      oklch(85% 0.02 260);    /* #c8c8cc - Ashen Bone */
  --muted:   oklch(40% 0.03 260);    /* #5a5a60 - Iron Grey */
  --border:  oklch(22% 0.03 260);    /* #2a2a32 - Cold Steel */
  
  /* Accents (Gritty) */
  --blood:   oklch(55% 0.22 25);     /* #d02030 - Dried Blood */
  --soul:    oklch(80% 0.18 200);    /* #60f0ff - Ethereal Cyan */
  --void:    oklch(35% 0.15 290);    /* #4a2070 - Corrupted Purple */
  --relic:   oklch(75% 0.12 80);     /* #b8a060 - Tarnished Gold */
  --slime:   oklch(70% 0.20 140);    /* #40c060 - Toxic Green */
}
```

## Sprite Posture
- **Resolution:** 32×32 base.
- **Outline:** 1px black (`#000000`) is mandatory for readability against dark backgrounds.
- **Texture:** Use "dithering" (checkerboard pixels) sparingly to create gradients on metal and bone.
- **Lighting:** Directional lighting from top-left. Shadows are deep and often "crushed" to black.
- **Animation:** 4-frame idle (subtle breathing/float), 6-frame walk, 4-frame attack (anticipation, strike, recovery).

## Material Rules
- **Bone:** Yellowish-white with brown shadows. Never pure white except for highlights.
- **Metal:** High contrast. Dark grey to near-white highlights.
- **Magic:** Pure saturation, often with a 1px "glow" aura of a lighter shade.
