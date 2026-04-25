"""
Build captioned App Store screenshots for Departure: Fitness Quest.

Output: 1290 × 2796 (iPhone 6.9" — current Apple standard, also accepted for 6.5").
Source screenshots are 1179 × 2556 (iPhone 16 Pro native). They are scaled to
1050 × 2276 and centered below a caption block on a dark violet gradient.

Run:  python3 scripts/build-app-store-screenshots.py
"""
from __future__ import annotations

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "public" / "screenshots"
DOWNLOADS = Path.home() / "Downloads"
OUT = ROOT / "app-store-screenshots"
OUT.mkdir(exist_ok=True)

# Output: iPhone 6.9" portrait
W, H = 1290, 2796

# Caption block (top zone)
CAP_TOP = 110          # top padding
CAP_HEIGHT = 360       # available text height
CAP_BOTTOM = CAP_TOP + CAP_HEIGHT  # = 470

# Phone screenshot (centered below caption)
PHONE_W, PHONE_H = 1050, 2276   # preserves 1179:2556 aspect
PHONE_X = (W - PHONE_W) // 2     # = 120
PHONE_Y = CAP_BOTTOM + 30        # = 500
CORNER_RADIUS = 60

# Brand palette — matches tailwind.config.js
BG_TOP = (15, 15, 26)        # #0F0F1A
BG_BOTTOM = (37, 22, 64)     # darker violet
GLOW_COLOR = (124, 58, 237)  # primary #7C3AED
TEXT_COLOR = (255, 255, 255)
SUB_COLOR = (167, 139, 250)  # primary-light #A78BFA — used for accent line

FONT_BOLD = "/System/Library/Fonts/SFNS.ttf"


def make_background() -> Image.Image:
    """Vertical dark→violet gradient with a soft top glow."""
    bg = Image.new("RGB", (W, H), BG_TOP)
    draw = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / H
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Soft violet glow behind the caption area
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse(
        [(W // 2 - 600, -300), (W // 2 + 600, 700)],
        fill=(*GLOW_COLOR, 70),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    bg = Image.alpha_composite(bg.convert("RGBA"), glow).convert("RGB")
    return bg


def fit_font(text: str, max_width: int, max_size: int = 130, min_size: int = 70) -> ImageFont.FreeTypeFont:
    """Pick the largest size that fits text within max_width."""
    size = max_size
    while size > min_size:
        font = ImageFont.truetype(FONT_BOLD, size)
        bbox = font.getbbox(text)
        if (bbox[2] - bbox[0]) <= max_width:
            return font
        size -= 4
    return ImageFont.truetype(FONT_BOLD, min_size)


def draw_caption(img: Image.Image, headline: str, subline: str | None = None) -> None:
    """Draw a 1- or 2-line caption block centered in the top zone."""
    draw = ImageDraw.Draw(img)
    max_text_width = W - 160  # 80px margin each side

    head_font = fit_font(headline, max_text_width)
    head_bbox = head_font.getbbox(headline)
    head_w = head_bbox[2] - head_bbox[0]
    head_h = head_bbox[3] - head_bbox[1]

    if subline:
        sub_font = fit_font(subline, max_text_width, max_size=60, min_size=40)
        sub_bbox = sub_font.getbbox(subline)
        sub_w = sub_bbox[2] - sub_bbox[0]
        sub_h = sub_bbox[3] - sub_bbox[1]
        gap = 32
        total_h = head_h + gap + sub_h
        y0 = CAP_TOP + (CAP_HEIGHT - total_h) // 2
        # Headline
        draw.text(((W - head_w) // 2, y0 - head_bbox[1]), headline, font=head_font, fill=TEXT_COLOR)
        # Subline (lighter)
        sy = y0 + head_h + gap - sub_bbox[1]
        draw.text(((W - sub_w) // 2, sy), subline, font=sub_font, fill=SUB_COLOR)
    else:
        y0 = CAP_TOP + (CAP_HEIGHT - head_h) // 2
        draw.text(((W - head_w) // 2, y0 - head_bbox[1]), headline, font=head_font, fill=TEXT_COLOR)


def round_corners(img: Image.Image, radius: int) -> Image.Image:
    """Mask the screenshot to rounded corners (phone-look)."""
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), img.size], radius=radius, fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img.convert("RGBA"), (0, 0), mask)
    return out


def composite(source_path: Path, headline: str, subline: str | None, out_name: str) -> None:
    """Render one App Store frame."""
    bg = make_background().convert("RGBA")
    draw_caption(bg, headline, subline)

    src = Image.open(source_path).convert("RGBA")
    src = src.resize((PHONE_W, PHONE_H), Image.LANCZOS)
    src = round_corners(src, CORNER_RADIUS)

    # Soft drop shadow under the phone
    shadow = Image.new("RGBA", (PHONE_W + 80, PHONE_H + 80), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        [(40, 40), (PHONE_W + 40, PHONE_H + 40)],
        radius=CORNER_RADIUS,
        fill=(0, 0, 0, 180),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    bg.paste(shadow, (PHONE_X - 40, PHONE_Y - 20), shadow)
    bg.paste(src, (PHONE_X, PHONE_Y), src)

    out_path = OUT / out_name
    bg.convert("RGB").save(out_path, "PNG", optimize=True)
    print(f"  ✓ {out_name}")


# ── Frame plan ──────────────────────────────────────────────────────────
FRAMES = [
    (SHOTS / "onboarding.png",      "Your Fitness is a Quest",        None,                              "01_quest.png"),
    (SHOTS / "transformation.png",  "Start as Your Current Self",     None,                              "02_current_self.png"),
    (SHOTS / "Goals.png",           "Choose Your Goal",               "Real fitness, real ambition.",    "03a_goal.png"),
    (SHOTS / "Disciplines.png",     "Choose Your Disciplines",        "Train how you actually train.",   "03b_disciplines.png"),
    (SHOTS / "home-screen.png",     "See Your Future Self",           "AI-rendered. Earned, not faked.", "04_future_self.png"),
    (SHOTS / "team-overview.png",   "Rally Your Team",                None,                              "05_team.png"),
    (SHOTS / "Workout_1.png",       "Every Workout Earns XP",         None,                              "06a_workout_xp.png"),
    (SHOTS / "Workout_2.png",       "Score Loot, Coins, and PRs",     None,                              "06b_workout_loot.png"),
    (DOWNLOADS / "Team_slay_1.png", "Slay Monsters Together",         None,                              "07_slay.png"),
]


def main() -> None:
    print(f"Building {len(FRAMES)} frames into {OUT}/")
    for src, headline, subline, name in FRAMES:
        if not src.exists():
            print(f"  ✗ MISSING {src}")
            continue
        composite(src, headline, subline, name)
    print("Done.")


if __name__ == "__main__":
    main()
