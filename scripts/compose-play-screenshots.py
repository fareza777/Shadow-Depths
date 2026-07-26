"""
Build Play Store phone screenshots: caption + phone frame + dark brand backdrop.
Usage: python scripts/compose-play-screenshots.py
"""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "store-assets"
OUT = ROOT / "store-assets" / "play-screenshots"

# Play Store friendly portrait size
W, H = 1080, 1920

# Shadow Depths palette
BG = (8, 6, 12)
BG2 = (18, 14, 24)
BRASS = (212, 190, 122)
BRASS_DIM = (122, 100, 60)
BONE = (232, 224, 208)
PANEL = (22, 18, 28)

# Best 8 shots with marketing captions (English — default listing)
SHOTS = [
    ("Screenshot_2026-07-13-07-12-04-848_com.shadowdepths.game.jpg",
     "Begin your melancholic descent"),
    ("Screenshot_2026-07-13-07-12-13-594_com.shadowdepths.game.jpg",
     "Choose a vigil — eight dark heroes"),
    ("Screenshot_2026-07-13-07-12-55-209_com.shadowdepths.game.jpg",
     "Fight turn by turn — read enemy intents"),
    ("Screenshot_2026-07-13-07-13-08-235_com.shadowdepths.game.jpg",
     "Loot rare tomes from forgotten crypts"),
    ("Screenshot_2026-07-13-07-13-14-737_com.shadowdepths.game.jpg",
     "Equip gear and grow stronger"),
    ("Screenshot_2026-07-13-07-13-20-379_com.shadowdepths.game.jpg",
     "Fill your satchel with relics"),
    ("Screenshot_2026-07-13-07-13-54-402_com.shadowdepths.game.jpg",
     "Free 10 floors — unlock all 100 forever"),
    ("Screenshot_2026-07-13-07-14-12-929_com.shadowdepths.game.jpg",
     "Vault bosses telegraph their slam"),
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\georgia.ttf" if not bold else r"C:\Windows\Fonts\georgiab.ttf",
        r"C:\Windows\Fonts\times.ttf" if not bold else r"C:\Windows\Fonts\timesbd.ttf",
        r"C:\Windows\Fonts\arial.ttf" if not bold else r"C:\Windows\Fonts\arialbd.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def make_backdrop() -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    # Vertical vignette
    for y in range(H):
        t = y / H
        shade = int(BG[2] + t * 10)
        draw.line([(0, y), (W, y)], fill=(BG[0], BG[1], min(40, shade)))
    # Soft corner blobs (dark, not cream — brand-aligned)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-200, -180, 520, 420), fill=(40, 28, 18, 70))
    od.ellipse((W - 480, H - 520, W + 160, H + 120), fill=(30, 20, 40, 80))
    od.ellipse((W // 2 - 300, H // 2 - 200, W // 2 + 300, H // 2 + 400), fill=(20, 14, 28, 40))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    # Fine dust points
    import random
    rnd = random.Random(42)
    d = ImageDraw.Draw(img)
    for _ in range(80):
        x, y = rnd.randint(0, W - 1), rnd.randint(0, H - 1)
        a = rnd.randint(30, 90)
        d.point((x, y), fill=(BRASS[0], BRASS[1], BRASS[2]))
    return img


def crop_chrome(shot: Image.Image) -> Image.Image:
    """Rough-crop Android status + nav bars for a cleaner phone inset."""
    w, h = shot.size
    top = int(h * 0.035)   # status bar
    bot = int(h * 0.045)   # nav bar
    return shot.crop((0, top, w, h - bot))


def fit_cover(im: Image.Image, tw: int, th: int) -> Image.Image:
    scale = max(tw / im.width, th / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt, max_w: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def draw_phone_frame(canvas: Image.Image, shot: Image.Image, box: tuple[int, int, int, int]) -> None:
    x, y, pw, ph = box
    radius = 48
    bezel = 10

    # Drop shadow (under everything)
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (x + 10, y + 18, x + pw + 10, y + ph + 18),
        radius=radius,
        fill=(0, 0, 0, 140),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas.alpha_composite(shadow)

    # Opaque bezel ring first (screen will cover the center)
    bezel_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bezel_layer)
    bd.rounded_rectangle(
        (x - bezel, y - bezel, x + pw + bezel, y + ph + bezel),
        radius=radius + 6,
        fill=(12, 10, 14, 255),
    )
    bd.rounded_rectangle(
        (x - bezel, y - bezel, x + pw + bezel, y + ph + bezel),
        radius=radius + 6,
        outline=(*BRASS_DIM, 255),
        width=3,
    )
    canvas.alpha_composite(bezel_layer)

    # Game screenshot on top of bezel center
    screen = fit_cover(shot.convert("RGB"), pw, ph)
    screen = ImageEnhance.Contrast(screen).enhance(1.05)
    screen = ImageEnhance.Color(screen).enhance(1.05)
    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, pw - 1, ph - 1), radius=36, fill=255)
    canvas.paste(screen, (x, y), mask)

    # Notch + rivets drawn last so they sit on the screen edge
    chrome = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(chrome)
    cd.rounded_rectangle(
        (x + pw // 2 - 70, y + 14, x + pw // 2 + 70, y + 28),
        radius=8,
        fill=(8, 6, 12, 220),
    )
    for cx, cy in (
        (x + 18, y + 18),
        (x + pw - 18, y + 18),
        (x + 18, y + ph - 18),
        (x + pw - 18, y + ph - 18),
    ):
        cd.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=(*BRASS, 255))
    canvas.alpha_composite(chrome)


def compose(shot_path: Path, caption: str, index: int) -> Path:
    base = make_backdrop().convert("RGBA")
    draw = ImageDraw.Draw(base)

    title_f = font(54, bold=True)
    sub_f = font(28, bold=False)
    brand_f = font(22, bold=True)

    # Brand strip
    draw.text((W // 2, 48), "SHADOW DEPTHS", font=brand_f, fill=BRASS_DIM, anchor="mt")

    # Caption
    max_caption_w = W - 120
    lines = wrap_text(draw, caption, title_f, max_caption_w)
    cy = 110
    for line in lines:
        draw.text((W // 2, cy), line, font=title_f, fill=BONE, anchor="mt")
        cy += 64

    # Thin brass rule under caption
    draw.line((W // 2 - 80, cy + 8, W // 2 + 80, cy + 8), fill=BRASS, width=2)
    draw.ellipse((W // 2 - 5, cy + 4, W // 2 + 5, cy + 14), fill=BRASS)

    # Phone box
    phone_w = 780
    phone_h = 1480
    phone_x = (W - phone_w) // 2
    phone_y = cy + 40
    # Keep phone inside canvas
    if phone_y + phone_h > H - 80:
        phone_h = H - 80 - phone_y
        phone_w = int(phone_h * 780 / 1480)
        phone_x = (W - phone_w) // 2

    shot = Image.open(shot_path).convert("RGB")
    shot = crop_chrome(shot)
    draw_phone_frame(base, shot, (phone_x, phone_y, phone_w, phone_h))

    # Footer hint
    draw.text((W // 2, H - 42), "Free floors 1–10  ·  One-time Full Descent unlock",
              font=sub_f, fill=BRASS_DIM, anchor="mt")

    out = OUT / f"play-shot-{index:02d}.png"
    base.convert("RGB").save(out, "PNG", optimize=True)
    # Also JPEG under 8MB for easy Console upload
    jpg = OUT / f"play-shot-{index:02d}.jpg"
    base.convert("RGB").save(jpg, "JPEG", quality=90, optimize=True)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"Writing to {OUT}")
    for i, (name, caption) in enumerate(SHOTS, start=1):
        path = SRC / name
        if not path.exists():
            raise SystemExit(f"Missing: {path}")
        out = compose(path, caption, i)
        print(f"  [{i}/8] {out.name} — {caption}")
    print("Done.")


if __name__ == "__main__":
    main()
