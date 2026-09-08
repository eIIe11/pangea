#!/usr/bin/env python3
"""Generate PWA / desktop icons from the Pangea coin artwork.

Run: python3 scripts/make-icons.py
Requires Pillow. Source art lives in src/assets/.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "assets" / "coin-teal.png"
PUBLIC = ROOT / "public"
TAURI = ROOT / "src-tauri" / "icons"
BG = (14, 17, 18, 255)  # graphite, matches --pg-bg


def trimmed() -> Image.Image:
    im = Image.open(SRC).convert("RGBA")
    box = im.getbbox()
    return im.crop(box) if box else im


def square(im: Image.Image, size: int, pad: float, bg: tuple[int, int, int, int] | None) -> Image.Image:
    inner = int(size * (1 - 2 * pad))
    art = im.copy()
    art.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), bg if bg else (0, 0, 0, 0))
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


def main() -> None:
    coin = trimmed()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    TAURI.mkdir(parents=True, exist_ok=True)

    square(coin, 192, 0.04, None).save(PUBLIC / "icon-192.png")
    square(coin, 512, 0.04, None).save(PUBLIC / "icon-512.png")
    # Maskable icons get 20% safe-area padding on an opaque plate.
    square(coin, 512, 0.20, BG).save(PUBLIC / "icon-maskable-512.png")
    square(coin, 180, 0.08, BG).save(PUBLIC / "apple-touch-icon.png")
    square(coin, 32, 0.02, None).save(PUBLIC / "favicon.png")

    for size in (32, 128, 256, 512):
        name = "128x128@2x.png" if size == 256 else f"{size}x{size}.png"
        square(coin, size, 0.04, None).save(TAURI / name)
    square(coin, 512, 0.04, None).save(TAURI / "icon.png")


if __name__ == "__main__":
    main()
