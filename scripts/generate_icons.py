#!/usr/bin/env python3
"""Generate toolbar/store PNGs from skipr-plugin/icons/icon.svg design."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "skipr-plugin" / "icons"
SIZES = (16, 32, 48, 128)

GRADIENT_START = (255, 68, 68)
GRADIENT_END = (200, 30, 30)
PLAY_PATH_24 = ((8, 5), (8, 19), (19, 12))
PLAY_CENTER = (13.5, 12.0)
CORNER_RADIUS_RATIO = 9 / 36


def _lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def _rounded_rect_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def make_icon(size: int) -> Image.Image:
    radius = max(2, round(size * CORNER_RADIUS_RATIO))
    gradient = Image.new("RGB", (size, size))
    pixels = gradient.load()
    denom = max(1, 2 * (size - 1))
    for y in range(size):
        for x in range(size):
            t = (x + y) / denom
            pixels[x, y] = (
                _lerp(GRADIENT_START[0], GRADIENT_END[0], t),
                _lerp(GRADIENT_START[1], GRADIENT_END[1], t),
                _lerp(GRADIENT_START[2], GRADIENT_END[2], t),
            )

    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    icon.paste(gradient, mask=_rounded_rect_mask(size, radius))

    center = size / 2
    scale = size / 48
    offset_x = center - PLAY_CENTER[0] * scale
    offset_y = center - PLAY_CENTER[1] * scale
    triangle = [
        (offset_x + x * scale, offset_y + y * scale)
        for x, y in PLAY_PATH_24
    ]
    ImageDraw.Draw(icon).polygon(triangle, fill=(255, 255, 255, 255))
    return icon


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = OUT_DIR / f"icon-{size}.png"
        make_icon(size).save(path, format="PNG")
        print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
