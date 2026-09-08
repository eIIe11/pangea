"""Flatten the supplied 3/4-view coin render into a head-on face texture.

The CSS coin is a real solid — two faces plus a rim (see src/components/Coin.tsx) — so it
needs a face seen straight on. The artwork is a perspective render, so the face reads as
an ellipse: un-squash that ellipse into a circle and cut it out.

Usage: python3 scripts/make-coin-face.py <render.png> src/assets/coin-face.webp
"""

import sys

from PIL import Image, ImageDraw, ImageFilter

# The face ellipse in the 2000x2000 render, measured from the artwork.
CENTER = (1027, 873)
SEMI_X = 364
SEMI_Y = 471
OUT = 512


def main(src: str, dst: str) -> None:
    coin = Image.open(src).convert('RGBA')
    face = coin.crop(
        (CENTER[0] - SEMI_X, CENTER[1] - SEMI_Y, CENTER[0] + SEMI_X, CENTER[1] + SEMI_Y)
    ).resize((OUT, OUT), Image.LANCZOS)

    # Circular alpha, feathered by a pixel so the rim meets the face without a seam.
    mask = Image.new('L', (OUT * 4, OUT * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, OUT * 4 - 1, OUT * 4 - 1), fill=255)
    mask = mask.resize((OUT, OUT), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))

    face.putalpha(mask)
    face.save(dst, 'WEBP', quality=90, method=6)
    print(f'{dst}: {face.size}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
