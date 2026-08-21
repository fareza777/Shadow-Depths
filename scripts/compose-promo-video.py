"""
Build a professional Play Store / YouTube promo trailer for Shadow Depths.

Output:
  store-assets/promo/shadow-depths-trailer.mp4   (1920x1080, ~30s)
  store-assets/promo/shadow-depths-trailer-portrait.mp4  (1080x1920, optional)

Requires: Pillow, ffmpeg on PATH.
Usage: python scripts/compose-promo-video.py
"""
from __future__ import annotations

import math
import os
import random
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "store-assets"
SHOTS = SRC / "play-screenshots"
OUT = SRC / "promo"
WORK = OUT / "_work"

# Landscape master (YouTube / Play Store promo)
LW, LH = 1920, 1080
FPS = 30

BG = (6, 4, 10)
BRASS = (212, 190, 122)
BRASS_DIM = (130, 110, 70)
BONE = (236, 228, 214)
EMBER = (180, 90, 40)

# Scene plan: (kind, source under store-assets, caption, hold_seconds)
# Shot sources are RAW device screenshots (not captioned play-shots) for a clean phone inset.
SCENES = [
    ("title", None, "a melancholic descent", 3.2),
    ("shot", "Screenshot_2026-07-13-07-12-04-848_com.shadowdepths.game.jpg", "Begin the descent", 3.6),
    ("shot", "Screenshot_2026-07-13-07-12-13-594_com.shadowdepths.game.jpg", "Eight dark vigils", 3.6),
    ("shot", "Screenshot_2026-07-13-07-12-55-209_com.shadowdepths.game.jpg", "Turn-based torchlight combat", 3.8),
    ("shot", "Screenshot_2026-07-13-07-13-08-235_com.shadowdepths.game.jpg", "Loot forgotten crypts", 3.6),
    ("shot", "Screenshot_2026-07-13-07-13-14-737_com.shadowdepths.game.jpg", "Forge your loadout", 3.6),
    ("shot", "Screenshot_2026-07-13-07-13-54-402_com.shadowdepths.game.jpg", "Permanent upgrades", 3.6),
    ("end", None, "All 100 floors free · optional ad-free upgrade", 4.2),
]

XFADE = 0.55  # seconds between scenes


def font(size: int, bold: bool = False, italic: bool = False) -> ImageFont.ImageFont:
    if italic and not bold:
        paths = [r"C:\Windows\Fonts\georgiai.ttf", r"C:\Windows\Fonts\timesi.ttf"]
    elif bold:
        paths = [r"C:\Windows\Fonts\georgiab.ttf", r"C:\Windows\Fonts\timesbd.ttf"]
    else:
        paths = [r"C:\Windows\Fonts\georgia.ttf", r"C:\Windows\Fonts\times.ttf"]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def ensure_ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if not path:
        raise SystemExit("ffmpeg not found on PATH")
    return path


def vignette(img: Image.Image, strength: float = 0.55) -> Image.Image:
    """Fast radial vignette via scaled gradient."""
    w, h = img.size
    # Build tiny radial map then upscale
    sw, sh = 64, 36
    overlay = Image.new("L", (sw, sh), 0)
    px = overlay.load()
    cx, cy = (sw - 1) / 2, (sh - 1) / 2
    max_r = math.hypot(cx, cy)
    for y in range(sh):
        for x in range(sw):
            r = math.hypot(x - cx, y - cy) / max_r
            px[x, y] = int(min(255, (r ** 1.55) * 255 * strength))
    overlay = overlay.resize((w, h), Image.Resampling.BICUBIC)
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    return Image.composite(dark, img, overlay)


def film_grain(img: Image.Image, amount: int = 12, seed: int = 0) -> Image.Image:
    """Cheap grain: noise on a small buffer, upscale + blend."""
    rnd = random.Random(seed)
    sw, sh = max(1, img.width // 4), max(1, img.height // 4)
    grain = Image.new("RGB", (sw, sh))
    px = grain.load()
    for y in range(sh):
        for x in range(sw):
            c = 128 + rnd.randint(-amount, amount)
            px[x, y] = (c, c, c)
    grain = grain.resize(img.size, Image.Resampling.BILINEAR)
    return Image.blend(img, grain, 0.06)


def make_backdrop(seed: int = 1) -> Image.Image:
    img = Image.new("RGB", (LW, LH), BG)
    draw = ImageDraw.Draw(img)
    for y in range(LH):
        t = y / LH
        r = int(6 + t * 8)
        g = int(4 + t * 4)
        b = int(10 + t * 14)
        draw.line([(0, y), (LW, y)], fill=(r, g, b))
    overlay = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-280, -220, 700, 520), fill=(50, 32, 18, 55))
    od.ellipse((LW - 780, LH - 560, LW + 200, LH + 140), fill=(28, 16, 40, 70))
    od.ellipse((LW // 2 - 420, 180, LW // 2 + 420, LH + 80), fill=(18, 12, 26, 45))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    rnd = random.Random(seed)
    d = ImageDraw.Draw(img)
    for _ in range(140):
        x, y = rnd.randint(0, LW - 1), rnd.randint(0, LH - 1)
        d.point((x, y), fill=BRASS)
    return img


def fit_contain(im: Image.Image, tw: int, th: int) -> Image.Image:
    scale = min(tw / im.width, th / im.height)
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def fit_cover(im: Image.Image, tw: int, th: int) -> Image.Image:
    scale = max(tw / im.width, th / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def draw_ornament_rule(draw: ImageDraw.ImageDraw, cx: int, y: int, half: int = 120) -> None:
    draw.line((cx - half, y, cx - 14, y), fill=BRASS, width=2)
    draw.line((cx + 14, y, cx + half, y), fill=BRASS, width=2)
    draw.ellipse((cx - 5, y - 5, cx + 5, y + 5), outline=BRASS, width=2)
    draw.ellipse((cx - 2, y - 2, cx + 2, y + 2), fill=BRASS)


def make_title_card() -> Image.Image:
    """Cinematic open: feature graphic keyed under title treatment."""
    base = make_backdrop(seed=7)
    feat = Image.open(SRC / "feature-graphic-1024x500.png").convert("RGB")
    # Soft full-bleed wash of key art
    wash = fit_cover(feat, LW, LH)
    wash = ImageEnhance.Brightness(wash).enhance(0.35)
    wash = ImageEnhance.Contrast(wash).enhance(1.15)
    wash = wash.filter(ImageFilter.GaussianBlur(1.2))
    base = Image.blend(base, wash, 0.72)

    # Center panel of key art sharper
    panel = fit_contain(feat, 1480, 720)
    px = (LW - panel.width) // 2
    py = (LH - panel.height) // 2 - 20
    # Soft shadow under panel
    shadow = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (px + 12, py + 18, px + panel.width + 12, py + panel.height + 18),
        radius=18,
        fill=(0, 0, 0, 160),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    base = Image.alpha_composite(base.convert("RGBA"), shadow)

    mask = Image.new("L", panel.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, panel.width - 1, panel.height - 1), radius=14, fill=255)
    base.paste(panel, (px, py), mask)

    # Brass frame
    frame = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle(
        (px - 4, py - 4, px + panel.width + 4, py + panel.height + 4),
        radius=16,
        outline=(*BRASS_DIM, 220),
        width=3,
    )
    base = Image.alpha_composite(base, frame).convert("RGB")

    draw = ImageDraw.Draw(base)
    # Top brand whisper
    draw.text((LW // 2, 36), "NOW ON GOOGLE PLAY", font=font(22, bold=True), fill=BRASS_DIM, anchor="mt")
    # Bottom tagline under panel
    ty = py + panel.height + 28
    draw.text((LW // 2, ty), "Turn-based dungeon roguelike", font=font(28, italic=True), fill=BONE, anchor="mt")
    draw_ornament_rule(draw, LW // 2, ty + 42, half=160)

    base = vignette(base, 0.48)
    return film_grain(base, 10, seed=11)


def make_end_card() -> Image.Image:
    base = make_backdrop(seed=99)
    feat = Image.open(SRC / "feature-graphic-1024x500.png").convert("RGB")
    wash = fit_cover(feat, LW, LH)
    wash = ImageEnhance.Brightness(wash).enhance(0.28)
    base = Image.blend(base, wash, 0.55)

    icon = Image.open(SRC / "app-icon-512.png").convert("RGBA")
    icon = icon.resize((220, 220), Image.Resampling.LANCZOS)
    # Icon plate
    plate = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    ix, iy = LW // 2 - 110, 150
    pd.rounded_rectangle((ix - 18, iy - 18, ix + 238, iy + 238), radius=40, fill=(12, 10, 16, 210))
    pd.rounded_rectangle((ix - 18, iy - 18, ix + 238, iy + 238), radius=40, outline=(*BRASS, 200), width=3)
    base = Image.alpha_composite(base.convert("RGBA"), plate)
    base.paste(icon, (ix, iy), icon)

    draw = ImageDraw.Draw(base)
    draw.text((LW // 2, 430), "SHADOW DEPTHS", font=font(72, bold=True), fill=BRASS, anchor="mt")
    draw_ornament_rule(draw, LW // 2, 520, half=200)
    draw.text((LW // 2, 555), "a melancholic descent", font=font(34, italic=True), fill=BONE, anchor="mt")

    # Benefit chips
    chips = [
        "All 100 floors free",
        "Turn-based roguelike",
        "One-time Remove Ads · no ads",
    ]
    cy = 640
    for text in chips:
        tw = int(draw.textlength(text, font=font(26)))
        bx0, bx1 = LW // 2 - tw // 2 - 28, LW // 2 + tw // 2 + 28
        draw.rounded_rectangle((bx0, cy, bx1, cy + 48), radius=8, outline=BRASS_DIM, width=2)
        draw.text((LW // 2, cy + 24), text, font=font(26), fill=BONE, anchor="mm")
        cy += 62

    draw.text((LW // 2, 980), "Available on Google Play", font=font(30, bold=True), fill=EMBER, anchor="mt")
    draw.text((LW // 2, 1030), "Descend. Die. Remember. Descend again.", font=font(22, italic=True), fill=BRASS_DIM, anchor="mt")

    base = vignette(base.convert("RGB"), 0.5)
    return film_grain(base, 10, seed=22)


def make_shot_card(shot_name: str, caption: str, seed: int) -> Image.Image:
    """Landscape card: blurred gameplay wash + sharp phone mockup + caption."""
    base = make_backdrop(seed=seed)
    shot_path = SRC / shot_name
    if not shot_path.exists():
        shot_path = SHOTS / shot_name
    shot = Image.open(shot_path).convert("RGB")
    # Crop Android status / nav chrome when using raw captures
    if "Screenshot_" in shot_name:
        w, h = shot.size
        shot = shot.crop((0, int(h * 0.035), w, h - int(h * 0.045)))

    # Background wash from the shot itself
    wash = fit_cover(shot, LW, LH)
    wash = wash.filter(ImageFilter.GaussianBlur(28))
    wash = ImageEnhance.Brightness(wash).enhance(0.32)
    wash = ImageEnhance.Color(wash).enhance(0.85)
    base = Image.blend(base, wash, 0.85)

    # Phone mockup — slightly left of center for editorial balance
    phone_h = 920
    phone_w = int(phone_h * shot.width / shot.height)
    phone = fit_cover(shot, phone_w, phone_h)
    phone = ImageEnhance.Contrast(phone).enhance(1.06)
    phone = ImageEnhance.Color(phone).enhance(1.04)

    px = int(LW * 0.28) - phone_w // 2
    py = (LH - phone_h) // 2 + 10

    # Shadow
    shadow = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (px + 16, py + 24, px + phone_w + 16, py + phone_h + 24),
        radius=42,
        fill=(0, 0, 0, 170),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    base = Image.alpha_composite(base.convert("RGBA"), shadow)

    # Bezel
    bezel = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bezel)
    pad = 12
    bd.rounded_rectangle(
        (px - pad, py - pad, px + phone_w + pad, py + phone_h + pad),
        radius=46,
        fill=(10, 8, 12, 255),
    )
    bd.rounded_rectangle(
        (px - pad, py - pad, px + phone_w + pad, py + phone_h + pad),
        radius=46,
        outline=(*BRASS_DIM, 255),
        width=3,
    )
    base = Image.alpha_composite(base, bezel)

    mask = Image.new("L", (phone_w, phone_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, phone_w - 1, phone_h - 1), radius=36, fill=255)
    base.paste(phone, (px, py), mask)

    # Notch
    chrome = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    cd = ImageDraw.Draw(chrome)
    cd.rounded_rectangle(
        (px + phone_w // 2 - 60, py + 12, px + phone_w // 2 + 60, py + 26),
        radius=7,
        fill=(6, 4, 10, 230),
    )
    for cx, cy in (
        (px + 16, py + 16),
        (px + phone_w - 16, py + 16),
        (px + 16, py + phone_h - 16),
        (px + phone_w - 16, py + phone_h - 16),
    ):
        cd.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=(*BRASS, 255))
    base = Image.alpha_composite(base, chrome).convert("RGB")

    # Right-side copy block
    draw = ImageDraw.Draw(base)
    tx = int(LW * 0.62)
    draw.text((tx, 220), "SHADOW DEPTHS", font=font(22, bold=True), fill=BRASS_DIM, anchor="lt")
    draw_ornament_rule(draw, tx + 100, 265, half=100)

    # Wrapped caption
    title_f = font(48, bold=True)
    words = caption.split()
    lines: list[str] = []
    cur = ""
    max_w = int(LW * 0.32)
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=title_f) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    cy = 300
    for line in lines:
        draw.text((tx, cy), line, font=title_f, fill=BONE, anchor="lt")
        cy += 58

    draw.text((tx, cy + 24), "100 floors · permadeath · torchlight", font=font(22, italic=True), fill=BRASS, anchor="lt")
    draw.text((tx, 980), "Free with ads  ·  Optional Remove Ads", font=font(20), fill=BRASS_DIM, anchor="lt")

    base = vignette(base, 0.42)
    return film_grain(base, 9, seed=seed)


def make_portrait_from_landscape(land: Image.Image) -> Image.Image:
    """Center-crop / letterbox landscape into 1080x1920 for Reels/Shorts."""
    pw, ph = 1080, 1920
    canvas = make_backdrop(seed=3).resize((pw, ph))
    # Scale landscape to width
    scaled = land.resize((pw, int(land.height * pw / land.width)), Image.Resampling.LANCZOS)
    if scaled.height > ph:
        top = (scaled.height - ph) // 2
        return scaled.crop((0, top, pw, top + ph))
    y = (ph - scaled.height) // 2
    canvas.paste(scaled, (0, y))
    return canvas


def write_scenes() -> list[tuple[Path, float]]:
    WORK.mkdir(parents=True, exist_ok=True)
    paths: list[tuple[Path, float]] = []
    for i, (kind, src, caption, hold) in enumerate(SCENES):
        out = WORK / f"scene_{i:02d}.png"
        if kind == "title":
            img = make_title_card()
        elif kind == "end":
            img = make_end_card()
        else:
            img = make_shot_card(src, caption, seed=30 + i)
        img.save(out, "PNG", optimize=True)
        print(f"  scene {i + 1}/{len(SCENES)}: {out.name} ({hold:.1f}s) - {caption}")
        paths.append((out, hold))
    return paths


def build_audio(ffmpeg: str, duration: float, out_wav: Path) -> None:
    """Dark brass-dungeon drone: layered sines + brown noise bed (royalty-free)."""
    cmd = [
        ffmpeg, "-y",
        "-filter_complex",
        (
            f"sine=frequency=55:sample_rate=44100:duration={duration}[a];"
            f"sine=frequency=82.4:sample_rate=44100:duration={duration}[b];"
            f"sine=frequency=110:sample_rate=44100:duration={duration}[c];"
            f"sine=frequency=164.8:sample_rate=44100:duration={duration}[d];"
            f"anoisesrc=color=brown:amplitude=0.04:sample_rate=44100:duration={duration}[n];"
            "[a]volume=0.20[a1];[b]volume=0.11[b1];[c]volume=0.07[c1];"
            "[d]volume=0.04,tremolo=f=0.15:d=0.35[d1];"
            "[n]lowpass=f=260,volume=0.5[n1];"
            "[a1][b1][c1][d1][n1]amix=inputs=5:dropout_transition=0:normalize=0,"
            "aformat=channel_layouts=stereo,"
            "lowpass=f=850,highpass=f=35,"
            f"afade=t=in:st=0:d=1.4,afade=t=out:st={max(0.1, duration - 2.2)}:d=2.2"
        ),
        "-t", f"{duration:.3f}",
        str(out_wav),
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def assemble_video(ffmpeg: str, scenes: list[tuple[Path, float]], portrait: bool = False) -> Path:
    """Ken Burns + xfade chain → H.264 mp4."""
    # Effective timeline with overlaps
    # For N scenes with holds h_i and xfade x:
    # total = sum(h_i) - (N-1)*x
    holds = [h for _, h in scenes]
    n = len(scenes)
    total = sum(holds) - (n - 1) * XFADE

    w, h = (1080, 1920) if portrait else (LW, LH)
    label = "portrait" if portrait else "landscape"
    clips_dir = WORK / label
    clips_dir.mkdir(parents=True, exist_ok=True)

    clip_paths: list[Path] = []
    for i, (img_path, hold) in enumerate(scenes):
        src = img_path
        if portrait:
            # Generate portrait companion once
            p_path = WORK / f"scene_{i:02d}_portrait.png"
            if not p_path.exists():
                make_portrait_from_landscape(Image.open(img_path)).save(p_path, "PNG")
            src = p_path

        frames = max(int(hold * FPS), FPS)
        # Alternate zoom direction for cinematic variety
        if i % 2 == 0:
            zexpr = "min(zoom+0.0008,1.15)"
            xexpr = "iw/2-(iw/zoom/2)"
            yexpr = "ih/2-(ih/zoom/2)"
        else:
            zexpr = "if(eq(on,1),1.15,max(zoom-0.0008,1.0))"
            xexpr = "iw/2-(iw/zoom/2)"
            yexpr = "ih/2-(ih/zoom/2)"

        clip = clips_dir / f"clip_{i:02d}.mp4"
        # Upscale before zoompan so Ken Burns stays sharp
        vf = (
            f"scale=4000:-1,"
            f"zoompan=z='{zexpr}':x='{xexpr}':y='{yexpr}':d={frames}:s={w}x{h}:fps={FPS},"
            f"format=yuv420p"
        )
        cmd = [
            ffmpeg, "-y",
            "-loop", "1", "-i", str(src),
            "-vf", vf,
            "-frames:v", str(frames),
            "-r", str(FPS),
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p",
            str(clip),
        ]
        print(f"  encoding clip {i + 1}/{n} ({label})…")
        subprocess.run(cmd, check=True, capture_output=True)
        clip_paths.append(clip)

    # Build xfade filter graph
    # offset_k = sum(h_0..h_k) - k*XFADE - XFADE  wait:
    # first xfade at hold0 - XFADE
    # second at hold0 + hold1 - 2*XFADE
    inputs: list[str] = []
    for p in clip_paths:
        inputs += ["-i", str(p)]

    if n == 1:
        fc = "[0:v]copy[vout]"
    else:
        parts: list[str] = []
        # Cumulative timeline offset for each xfade
        offset = holds[0] - XFADE
        transitions = ["fade", "fadeblack", "fade", "slideleft", "fade", "slideright", "fadeblack"]
        for i in range(n - 1):
            left = "[0:v]" if i == 0 else f"[v{i - 1}]"
            right = f"[{i + 1}:v]"
            out_label = "[vout]" if i == n - 2 else f"[v{i}]"
            trans = transitions[i % len(transitions)]
            parts.append(
                f"{left}{right}xfade=transition={trans}:duration={XFADE:.3f}:offset={offset:.3f}{out_label}"
            )
            if i < n - 2:
                offset += holds[i + 1] - XFADE
        fc = ";".join(parts)

    silent = WORK / f"video_{label}_silent.mp4"
    cmd = [
        ffmpeg, "-y",
        *inputs,
        "-filter_complex", fc,
        "-map", "[vout]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "17",
        "-r", str(FPS),
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(silent),
    ]
    print(f"  crossfading {n} clips ({label})…")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stderr[-2000:], file=sys.stderr)
        raise SystemExit(f"xfade failed ({label})")

    # Probe actual duration
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        ffprobe = str(Path(ffmpeg).with_name("ffprobe.exe" if os.name == "nt" else "ffprobe"))
    probe = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(silent)],
        capture_output=True, text=True,
    )
    dur = float(probe.stdout.strip() or total)

    audio = WORK / "score.wav"
    print(f"  generating ambient score ({dur:.1f}s)…")
    build_audio(ffmpeg, dur, audio)

    out_name = "shadow-depths-trailer-portrait.mp4" if portrait else "shadow-depths-trailer.mp4"
    final = OUT / out_name
    cmd = [
        ffmpeg, "-y",
        "-i", str(silent),
        "-i", str(audio),
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        str(final),
    ]
    print(f"  muxing audio -> {final.name}")
    subprocess.run(cmd, check=True, capture_output=True)
    return final


def main() -> None:
    ffmpeg = ensure_ffmpeg()
    OUT.mkdir(parents=True, exist_ok=True)
    if WORK.exists():
        shutil.rmtree(WORK)
    WORK.mkdir(parents=True)

    print("Composing cinematic scenes…")
    scenes = write_scenes()

    print("Assembling landscape trailer (YouTube / Play Store)…")
    land = assemble_video(ffmpeg, scenes, portrait=False)
    print(f"  -> {land} ({land.stat().st_size // 1024} KB)")

    print("Assembling portrait trailer (Shorts / Reels)...")
    port = assemble_video(ffmpeg, scenes, portrait=True)
    print(f"  -> {port} ({port.stat().st_size // 1024} KB)")

    # Keep scene stills as preview posters
    for i, (p, _) in enumerate(scenes):
        shutil.copy2(p, OUT / f"poster-{i:02d}.png")
    shutil.copy2(scenes[0][0], OUT / "poster-title.png")
    shutil.copy2(scenes[-1][0], OUT / "poster-end.png")

    print("\nDone.")
    print(f"  Landscape: {land}")
    print(f"  Portrait:  {port}")
    print("Upload the landscape MP4 to YouTube (unlisted/public), then paste the URL")
    print("into Play Console -> Store listing -> Promotional video.")


if __name__ == "__main__":
    main()
