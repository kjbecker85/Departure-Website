#!/usr/bin/env python3
"""
Generate Instagram-ready images (1080x1350, 4:5) for all social media posts.
Creates monster stat cards, feature screenshots, and engagement posts.
"""

import os
import json
from PIL import Image, ImageDraw, ImageFont

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
PUBLIC = os.path.join(ROOT, "public")
SOCIAL_DIR = os.path.join(PUBLIC, "social")
MONSTERS_DIR = os.path.join(PUBLIC, "monsters")
SCREENSHOTS_DIR = os.path.join(PUBLIC, "screenshots")

# Instagram dimensions (4:5 portrait)
W, H = 1080, 1350

# Brand colors
BG_COLOR = (15, 15, 26)        # #0F0F1A
SURFACE = (26, 26, 46)         # #1A1A2E
PRIMARY = (124, 58, 237)       # #7C3AED
PRIMARY_LIGHT = (167, 139, 250) # #A78BFA
ACCENT = (6, 182, 212)         # #06B6D4
TEXT = (230, 230, 240)
TEXT_MUTED = (140, 140, 160)
GOLD = (245, 158, 11)          # #F59E0B
RED = (239, 68, 68)            # #EF4444

# Group colors
GROUP_COLORS = {
    "goblin": (34, 197, 94),    # green
    "swamp": (34, 197, 94),
    "forest": (34, 197, 94),
    "skeleton": (148, 163, 184), # slate
    "dark_sorcerer": (148, 163, 184),
    "lich": (148, 163, 184),
    "bone": (148, 163, 184),
    "orc": (59, 130, 246),      # blue
    "stone": (59, 130, 246),
    "minotaur": (59, 130, 246),
    "dire": (245, 158, 11),     # amber
    "frost": (245, 158, 11),
    "kraken": (245, 158, 11),
    "swarm": (245, 158, 11),
    "shadow": (168, 85, 247),   # purple
    "ancient": (168, 85, 247),
    "dragon": (168, 85, 247),
    "world": (168, 85, 247),
    "titan": (239, 68, 68),     # red
    "allfather": (239, 68, 68),
    "ragnarok": (239, 68, 68),
    "celestial": (239, 68, 68),
}

# Monster data
MONSTERS = {
    "goblin_scout": {"name": "Goblin Scout", "group": "Goblin Horde", "str": 10, "def": 6, "res": 8, "desc": "A sneaky scout lurking in the shadows"},
    "swamp_rat": {"name": "Swamp Rat", "group": "Goblin Horde", "str": 14, "def": 8, "res": 10, "desc": "Vicious rodent from the marshlands"},
    "goblin_shaman": {"name": "Goblin Shaman", "group": "Goblin Horde", "str": 18, "def": 10, "res": 16, "desc": "Twisted magic from the swamps"},
    "forest_spider": {"name": "Forest Spider", "group": "Goblin Horde", "str": 22, "def": 12, "res": 16, "desc": "Eight-legged terror of the woods"},
    "skeleton_warrior": {"name": "Skeleton Warrior", "group": "Undead Legion", "str": 30, "def": 20, "res": 24, "desc": "Risen bones wielding rusted blades"},
    "dark_sorcerer": {"name": "Dark Sorcerer", "group": "Undead Legion", "str": 50, "def": 24, "res": 44, "desc": "Channels forbidden necromantic arts"},
    "lich_king": {"name": "Lich King", "group": "Undead Legion", "str": 70, "def": 50, "res": 60, "desc": "Undead sovereign of dark dominion"},
    "bone_colossus": {"name": "Bone Colossus", "group": "Undead Legion", "str": 90, "def": 80, "res": 70, "desc": "Towering construct of fused skeletons"},
    "orc_berserker": {"name": "Orc Berserker", "group": "Orc Warband", "str": 100, "def": 70, "res": 80, "desc": "Rage-fueled warrior charging blind"},
    "stone_golem": {"name": "Stone Golem", "group": "Orc Warband", "str": 110, "def": 100, "res": 90, "desc": "Living rock guardian of orc strongholds"},
    "orc_warchief": {"name": "Orc Warchief", "group": "Orc Warband", "str": 120, "def": 90, "res": 110, "desc": "Commands the horde with iron fists"},
    "minotaur_champion": {"name": "Minotaur Champion", "group": "Orc Warband", "str": 140, "def": 110, "res": 120, "desc": "Bull-headed arena champion"},
    "dire_wolf_pack": {"name": "Dire Wolf Pack", "group": "Ancient Beasts", "str": 160, "def": 120, "res": 140, "desc": "Coordinated predators of the frozen wastes"},
    "frost_giant": {"name": "Frost Giant", "group": "Ancient Beasts", "str": 180, "def": 150, "res": 160, "desc": "Mountain-sized titan of ice and stone"},
    "kraken": {"name": "Kraken", "group": "Ancient Beasts", "str": 200, "def": 180, "res": 160, "desc": "Terror of the deep, devourer of ships"},
}

def get_font(size):
    """Try to load a system font, fall back to default."""
    font_paths = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for fp in font_paths:
        try:
            return ImageFont.truetype(fp, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()

def get_group_color(slug):
    """Get the group color for a monster based on its slug."""
    for key, color in GROUP_COLORS.items():
        if key in slug:
            return color
    return PRIMARY

def draw_stat_bar(draw, x, y, w, h, value, max_value, color, label, font_small):
    """Draw a stat bar with label and value."""
    # Background bar
    draw.rounded_rectangle([x, y, x + w, y + h], radius=4, fill=(40, 40, 60))
    # Filled portion
    fill_w = int(w * min(value / max_value, 1.0))
    if fill_w > 0:
        draw.rounded_rectangle([x, y, x + fill_w, y + h], radius=4, fill=color)
    # Label
    draw.text((x, y - 22), label, fill=TEXT_MUTED, font=font_small)
    # Value
    val_text = str(value)
    bbox = draw.textbbox((0, 0), val_text, font=font_small)
    draw.text((x + w - (bbox[2] - bbox[0]), y - 22), val_text, fill=TEXT, font=font_small)

def create_monster_card(slug, data, output_path):
    """Create a monster stat card image."""
    img = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(img)

    group_color = get_group_color(slug)

    # Fonts
    font_title = get_font(52)
    font_group = get_font(24)
    font_desc = get_font(22)
    font_stat_label = get_font(20)
    font_stat_value = get_font(36)
    font_small = get_font(18)
    font_brand = get_font(28)

    # Top: "DEPARTURE" branding
    brand = "DEPARTURE"
    bbox = draw.textbbox((0, 0), brand, font=font_brand)
    bw = bbox[2] - bbox[0]
    draw.text(((W - bw) // 2, 40), brand, fill=PRIMARY, font=font_brand)

    # Group label
    group_text = data["group"].upper()
    bbox = draw.textbbox((0, 0), group_text, font=font_group)
    gw = bbox[2] - bbox[0]
    draw.text(((W - gw) // 2, 85), group_text, fill=group_color, font=font_group)

    # Decorative line
    draw.line([(W // 2 - 100, 120), (W // 2 + 100, 120)], fill=group_color, width=2)

    # Monster art
    monster_path = os.path.join(MONSTERS_DIR, f"{slug}.png")
    if os.path.exists(monster_path):
        monster = Image.open(monster_path).convert("RGBA")
        # Scale to ~500px
        mw, mh = monster.size
        scale = 500 / max(mw, mh)
        new_w, new_h = int(mw * scale), int(mh * scale)
        monster = monster.resize((new_w, new_h), Image.LANCZOS)

        # Create a dark circular backdrop
        backdrop_size = 520
        backdrop = Image.new("RGBA", (backdrop_size, backdrop_size), (0, 0, 0, 0))
        bd = ImageDraw.Draw(backdrop)
        bd.ellipse([0, 0, backdrop_size, backdrop_size], fill=(20, 20, 35, 200))

        bx = (W - backdrop_size) // 2
        by = 140
        img.paste(Image.alpha_composite(Image.new("RGBA", img.size, (0, 0, 0, 0)),
                  Image.new("RGBA", img.size, (0, 0, 0, 0))).convert("RGB"), (0, 0))
        img = Image.new("RGB", (W, H), BG_COLOR)
        draw = ImageDraw.Draw(img)

        # Redraw top elements
        draw.text(((W - bw) // 2, 40), brand, fill=PRIMARY, font=font_brand)
        draw.text(((W - gw) // 2, 85), group_text, fill=group_color, font=font_group)
        draw.line([(W // 2 - 100, 120), (W // 2 + 100, 120)], fill=group_color, width=2)

        # Draw circular backdrop
        for i in range(backdrop_size):
            for j in range(backdrop_size):
                cx, cy = backdrop_size // 2, backdrop_size // 2
                dist = ((i - cx) ** 2 + (j - cy) ** 2) ** 0.5
                if dist < backdrop_size // 2:
                    alpha = max(0, 1 - dist / (backdrop_size // 2))
                    r, g, b = img.getpixel((bx + i, by + j))
                    nr = int(r * (1 - alpha * 0.5) + 25 * alpha * 0.5)
                    ng = int(g * (1 - alpha * 0.5) + 25 * alpha * 0.5)
                    nb = int(b * (1 - alpha * 0.5) + 40 * alpha * 0.5)
                    img.putpixel((bx + i, by + j), (nr, ng, nb))

        # Paste monster
        mx = (W - new_w) // 2
        my = 140 + (backdrop_size - new_h) // 2
        img.paste(monster, (mx, my), monster)
        draw = ImageDraw.Draw(img)

    # Monster name
    name = data["name"].upper()
    bbox = draw.textbbox((0, 0), name, font=font_title)
    nw = bbox[2] - bbox[0]
    draw.text(((W - nw) // 2, 690), name, fill=TEXT, font=font_title)

    # Description
    desc = f'"{data["desc"]}"'
    bbox = draw.textbbox((0, 0), desc, font=font_desc)
    dw = bbox[2] - bbox[0]
    draw.text(((W - dw) // 2, 755), desc, fill=TEXT_MUTED, font=font_desc)

    # Stat bars
    bar_y_start = 820
    bar_w = 700
    bar_h = 28
    bar_x = (W - bar_w) // 2
    bar_gap = 75

    max_stat = max(data["str"], data["def"], data["res"]) * 1.3

    # STR
    draw_stat_bar(draw, bar_x, bar_y_start, bar_w, bar_h, data["str"], max_stat, RED, "STR", font_stat_label)
    # DEF
    draw_stat_bar(draw, bar_x, bar_y_start + bar_gap, bar_w, bar_h, data["def"], max_stat, ACCENT, "DEF", font_stat_label)
    # RES
    draw_stat_bar(draw, bar_x, bar_y_start + bar_gap * 2, bar_w, bar_h, data["res"], max_stat, (34, 197, 94), "RES", font_stat_label)

    # Big stat numbers
    stats_y = 1060
    stat_w = W // 3
    for i, (label, val, color) in enumerate([("STR", data["str"], RED), ("DEF", data["def"], ACCENT), ("RES", data["res"], (34, 197, 94))]):
        cx = stat_w * i + stat_w // 2
        val_str = str(val)
        bbox = draw.textbbox((0, 0), val_str, font=font_stat_value)
        vw = bbox[2] - bbox[0]
        draw.text((cx - vw // 2, stats_y), val_str, fill=color, font=font_stat_value)
        bbox = draw.textbbox((0, 0), label, font=font_stat_label)
        lw = bbox[2] - bbox[0]
        draw.text((cx - lw // 2, stats_y + 44), label, fill=TEXT_MUTED, font=font_stat_label)

    # Bottom branding
    tagline = "departure.engagequalia.com"
    bbox = draw.textbbox((0, 0), tagline, font=font_small)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, H - 45), tagline, fill=TEXT_MUTED, font=font_small)

    # Decorative corners
    corner_len = 40
    draw.line([(30, 30), (30 + corner_len, 30)], fill=group_color, width=3)
    draw.line([(30, 30), (30, 30 + corner_len)], fill=group_color, width=3)
    draw.line([(W - 30, 30), (W - 30 - corner_len, 30)], fill=group_color, width=3)
    draw.line([(W - 30, 30), (W - 30, 30 + corner_len)], fill=group_color, width=3)
    draw.line([(30, H - 30), (30 + corner_len, H - 30)], fill=group_color, width=3)
    draw.line([(30, H - 30), (30, H - 30 - corner_len)], fill=group_color, width=3)
    draw.line([(W - 30, H - 30), (W - 30 - corner_len, H - 30)], fill=group_color, width=3)
    draw.line([(W - 30, H - 30), (W - 30, H - 30 - corner_len)], fill=group_color, width=3)

    img.save(output_path, "JPEG", quality=92)
    print(f"  Created: {os.path.basename(output_path)}")

def create_screenshot_post(screenshot_name, output_name, title=None, subtitle=None):
    """Create a branded screenshot post — screenshot fills most of the frame."""
    img = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(img)

    font_brand = get_font(36)
    font_sub = get_font(22)
    font_url = get_font(16)

    # Reserve space for branding
    top_margin = 75 if title else 20
    bottom_margin = 50
    available_h = H - top_margin - bottom_margin

    # Load screenshot and scale to fill the available space
    ss_path = os.path.join(SCREENSHOTS_DIR, screenshot_name)
    if os.path.exists(ss_path):
        ss = Image.open(ss_path).convert("RGBA")
        sw, sh = ss.size

        # Scale to fit width (with small padding) or height, whichever is constraining
        max_w = W - 60  # 30px padding each side
        scale_w = max_w / sw
        scale_h = available_h / sh
        scale = min(scale_w, scale_h)

        new_w = int(sw * scale)
        new_h = int(sh * scale)
        ss = ss.resize((new_w, new_h), Image.LANCZOS)

        # Center horizontally, position below title
        x = (W - new_w) // 2
        y = top_margin + (available_h - new_h) // 2
        img.paste(ss, (x, y), ss)
        draw = ImageDraw.Draw(img)

    # Title — compact at top
    if title:
        title_text = f"{title}"
        if subtitle:
            title_text = f"{title} — {subtitle}"
        bbox = draw.textbbox((0, 0), title_text, font=font_brand)
        tw = bbox[2] - bbox[0]
        draw.text(((W - tw) // 2, 20), title_text, fill=PRIMARY, font=font_brand)

    # Bottom URL
    url = "departure.engagequalia.com"
    bbox = draw.textbbox((0, 0), url, font=font_url)
    uw = bbox[2] - bbox[0]
    draw.text(((W - uw) // 2, H - 30), url, fill=TEXT_MUTED, font=font_url)

    output_path = os.path.join(SOCIAL_DIR, output_name)
    img.save(output_path, "JPEG", quality=92)
    print(f"  Created: {output_name}")

def main():
    os.makedirs(SOCIAL_DIR, exist_ok=True)

    print("Generating monster stat cards...")
    for slug, data in MONSTERS.items():
        output_path = os.path.join(SOCIAL_DIR, f"monster-{slug.replace('_', '-')}.jpg")
        create_monster_card(slug, data, output_path)

    print("\nGenerating screenshot posts...")
    screenshots = [
        ("home-screen.png", "home-screen.jpg", "DEPARTURE", "Fitness Quest"),
        ("transformation.png", "transformation.jpg", "DEPARTURE", "AI Future Self"),
        ("workout-log.png", "workout-log.jpg", "DEPARTURE", "Workout Tracker"),
        ("team-journey.png", "team-journey.jpg", "DEPARTURE", "Team Journey"),
        ("equipment.png", "equipment.jpg", "DEPARTURE", "Equipment & Loot"),
        ("exercise-picker.png", "exercise-picker.jpg", "DEPARTURE", "Exercise Picker"),
        ("challenges.png", "challenges.jpg", "DEPARTURE", "Daily Challenges"),
        ("shop-armory.png", "shop-armory.jpg", "DEPARTURE", "The Armory"),
        ("training-log.png", "training-log.jpg", "DEPARTURE", "Training Log"),
        ("battle-results.png", "battle-results.jpg", "DEPARTURE", "Battle Results"),
        ("premium-store.png", "premium-store.jpg", "DEPARTURE", "Premium Store"),
        ("onboarding.png", "onboarding.jpg", "DEPARTURE", "Get Started"),
        ("home-warlord.png", "home-warlord.jpg", "DEPARTURE", "Your Progress"),
    ]

    for ss_name, out_name, title, subtitle in screenshots:
        if os.path.exists(os.path.join(SCREENSHOTS_DIR, ss_name)):
            create_screenshot_post(ss_name, out_name, title, subtitle)
        else:
            print(f"  SKIP (not found): {ss_name}")

    # Create ranks post (reuse home-warlord or home-screen)
    create_screenshot_post("home-warlord.png", "ranks.jpg", "DEPARTURE", "24 Ranks: Recruit to Legend")

    # Create anti-cheat post (reuse workout-log or training-log)
    create_screenshot_post("training-log.png", "anti-cheat.jpg", "DEPARTURE", "Anti-Cheat System")

    print(f"\nDone! All images saved to {SOCIAL_DIR}")

if __name__ == "__main__":
    main()
