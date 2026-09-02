"""Renders a Roadmap Generator result as a downloadable PNG infographic —
a vertical timeline with each phase as a card, connected by a spine line.

Fully offline, dependency-light (Pillow only, already vendored for other
modules' image needs) — deliberately NOT an AI-generated illustration, to
keep the app's zero-cost/offline design (see README's "Why this design").
Uses the institution's static brand colors (navy/gold — the same defaults
documented in frontend/tailwind.config.js) rather than the live per-student
theme, since a downloaded image is a fixed artifact, not part of the
themed UI.
"""
from __future__ import annotations

import textwrap
import uuid
from typing import Any

import config

NAVY = (11, 31, 58)          # #0b1f3a
NAVY_SOFT = (232, 236, 242)  # light card background
GOLD = (217, 134, 0)         # #D98600
INK = (30, 41, 59)           # slate-800 body text
MUTED = (100, 116, 139)      # slate-500
WHITE = (255, 255, 255)
GOOD = (5, 150, 105)         # emerald-600, for the milestone badge

CANVAS_WIDTH = 1000
MARGIN_X = 60
SPINE_X = 96
CARD_X = 140
CARD_WIDTH = CANVAS_WIDTH - CARD_X - MARGIN_X


def _font(size: int, bold: bool = False):
    from PIL import ImageFont

    candidates = (
        ["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"]
        if bold
        else ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"]
    )
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _wrap(text: str, width_chars: int) -> list[str]:
    return textwrap.wrap(text or "", width=width_chars) or [""]


def _safe(text: Any) -> str:
    return str(text).strip() if text else ""


def build_roadmap_image(roadmap: dict) -> str:
    from PIL import Image, ImageDraw

    phases = roadmap.get("phases") or []
    title_font = _font(30, bold=True)
    subtitle_font = _font(16)
    heading_font = _font(19, bold=True)
    goal_font = _font(15)
    body_font = _font(15)
    small_font = _font(13)
    footer_font = _font(14)

    # --- Pass 1: measure each phase card's height up front, so the canvas
    # can be sized exactly (no wasted whitespace, no clipped text). ---
    def _card_height(phase: dict) -> int:
        h = 24  # top padding
        h += 26  # phase label + name line
        if phase.get("goal"):
            h += 20 * len(_wrap(phase["goal"], 78)) + 6
        topics = phase.get("topics") or []
        if topics:
            h += 22  # "Topics to cover" heading
            for t in topics:
                h += 20 * len(_wrap(f"• {t}", 80))
        resources = phase.get("resources") or []
        if resources:
            h += 22
            h += 20 * len(_wrap("Resources: " + "; ".join(resources), 82))
        if phase.get("milestone"):
            h += 12 + 22 * len(_wrap(f"Milestone: {phase['milestone']}", 76))
        h += 22  # bottom padding
        return h

    card_heights = [_card_height(p) for p in phases]

    header_h = 175
    gap_between_cards = 34
    footer_h = 90 if roadmap.get("weekly_checklist_tip") else 50
    total_h = header_h + sum(card_heights) + gap_between_cards * max(0, len(phases) - 1) + footer_h + 40

    img = Image.new("RGB", (CANVAS_WIDTH, max(total_h, 400)), WHITE)
    draw = ImageDraw.Draw(img)

    # --- Header band ---
    draw.rectangle([0, 0, CANVAS_WIDTH, header_h], fill=NAVY)
    draw.text((MARGIN_X, 34), "Personalized Roadmap", font=subtitle_font, fill=GOLD)
    role_line = _safe(roadmap.get("target_role")) or "Career Roadmap"
    draw.text((MARGIN_X, 56), role_line, font=title_font, fill=WHITE)
    tf = _safe(roadmap.get("timeframe"))
    if tf:
        draw.text((MARGIN_X, 100), f"Timeframe: {tf}", font=subtitle_font, fill=NAVY_SOFT)
    overview = _safe(roadmap.get("overview"))
    if overview:
        for i, line in enumerate(_wrap(overview, 100)[:2]):
            draw.text((MARGIN_X, 124 + i * 18), line, font=small_font, fill=NAVY_SOFT)

    # --- Spine + phase cards ---
    y = header_h + 30
    spine_top = y
    for phase, card_h in zip(phases, card_heights):
        # Node on the spine
        node_y = y + 20
        draw.ellipse([SPINE_X - 9, node_y - 9, SPINE_X + 9, node_y + 9], fill=GOLD)
        draw.ellipse([SPINE_X - 4, node_y - 4, SPINE_X + 4, node_y + 4], fill=WHITE)

        # Card
        draw.rounded_rectangle(
            [CARD_X, y, CARD_X + CARD_WIDTH, y + card_h], radius=14, fill=NAVY_SOFT, outline=(210, 217, 227), width=1
        )
        cy = y + 24
        cx = CARD_X + 22
        draw.text((cx, cy), _safe(phase.get("name")) or "Phase", font=heading_font, fill=NAVY)
        cy += 30
        if phase.get("goal"):
            for line in _wrap(phase["goal"], 78):
                draw.text((cx, cy), line, font=goal_font, fill=MUTED)
                cy += 20
            cy += 6
        topics = phase.get("topics") or []
        if topics:
            draw.text((cx, cy), "Topics to cover", font=body_font, fill=NAVY)
            cy += 22
            for t in topics:
                for line in _wrap(f"• {t}", 80):
                    draw.text((cx, cy), line, font=body_font, fill=INK)
                    cy += 20
        resources = phase.get("resources") or []
        if resources:
            draw.text((cx, cy), "Resources", font=body_font, fill=NAVY)
            cy += 22
            for line in _wrap("; ".join(resources), 82):
                draw.text((cx, cy), line, font=small_font, fill=MUTED)
                cy += 20
        if phase.get("milestone"):
            cy += 10
            badge_lines = _wrap(f"Milestone: {phase['milestone']}", 76)
            badge_h = 22 * len(badge_lines) + 10
            draw.rounded_rectangle(
                [cx, cy, CARD_X + CARD_WIDTH - 20, cy + badge_h], radius=8, fill=(220, 245, 235)
            )
            by = cy + 6
            for line in badge_lines:
                draw.text((cx + 10, by), line, font=small_font, fill=GOOD)
                by += 20

        y += card_h + gap_between_cards

    spine_bottom = y - gap_between_cards
    if phases:
        draw.line([(SPINE_X, spine_top + 20), (SPINE_X, spine_bottom + 20)], fill=GOLD, width=3)

    # --- Footer ---
    tip = _safe(roadmap.get("weekly_checklist_tip"))
    footer_y = y + 10
    draw.line([(MARGIN_X, footer_y), (CANVAS_WIDTH - MARGIN_X, footer_y)], fill=(220, 224, 230), width=1)
    if tip:
        draw.text((MARGIN_X, footer_y + 16), "Tip:", font=body_font, fill=NAVY)
        for i, line in enumerate(_wrap(tip, 100)):
            draw.text((MARGIN_X + 40, footer_y + 16 + i * 18), line, font=footer_font, fill=INK)

    out_path = config.GENERATED_DIR / f"roadmap_{uuid.uuid4().hex}.png"
    img.save(out_path, format="PNG")
    return str(out_path)
