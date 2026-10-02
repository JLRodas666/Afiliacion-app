"""Reassemble an original PDF image with its embedded transparency mask."""
import sys
from PIL import Image

with Image.open(sys.argv[1]) as color, Image.open(sys.argv[2]) as mask:
    original = color.convert("RGBA")
    original.putalpha(mask.convert("L"))
    original.save(sys.argv[3])
