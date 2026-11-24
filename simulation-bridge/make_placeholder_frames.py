"""Generate the placeholder stills served by mock_pi.py.

These exist so the dashboard's camera panel can be built and demonstrated
without hardware. They are obviously synthetic -- a test card, not footage --
and the mock labels them ``X-Camera-Source: simulated``, so they can never pass
for a field camera.

The JPEGs are committed, so this only needs to run when you want to change the
placeholder:

    python simulation-bridge/make_placeholder_frames.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 960, 540
ACCENTS = {
    "southbound": (37, 139, 212),
    "northbound": (67, 211, 158),
}
FRAMES_DIR = Path(__file__).resolve().parent / "frames"

FONT_CANDIDATES = (
    "C:/Windows/Fonts/arialbd.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
)


def font(size: int):
    for candidate in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def build(movement: str, accent: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), (11, 28, 43))
    draw = ImageDraw.Draw(image)

    for x in range(0, WIDTH, 40):
        draw.line([(x, 0), (x, HEIGHT)], fill=(19, 42, 61), width=1)
    for y in range(0, HEIGHT, 40):
        draw.line([(0, y), (WIDTH, y)], fill=(19, 42, 61), width=1)

    cx, cy = WIDTH // 2, 214
    draw.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], outline=(96, 116, 132), width=2)
    draw.line([(cx, cy - 88), (cx, cy + 88)], fill=(96, 116, 132), width=2)
    draw.line([(cx - 88, cy), (cx + 88, cy)], fill=(96, 116, 132), width=2)

    for x, y, dx, dy in (
        (30, 30, 1, 1),
        (WIDTH - 30, 30, -1, 1),
        (30, HEIGHT - 30, 1, -1),
        (WIDTH - 30, HEIGHT - 30, -1, -1),
    ):
        draw.line([(x, y), (x + dx * 46, y)], fill=(150, 170, 185), width=3)
        draw.line([(x, y), (x, y + dy * 46)], fill=(150, 170, 185), width=3)

    draw.rectangle([0, HEIGHT - 12, WIDTH, HEIGHT], fill=accent)

    # All copy sits low and centred: the panel puts the movement label top-left
    # and the device/age bottom-right, and a cropped or letterboxed frame must
    # not collide with either.
    draw.text((cx, 344), "SIMULATED FRAME", font=font(44), fill=(236, 244, 250), anchor="mm")
    draw.text((cx, 396), movement.upper(), font=font(26), fill=accent, anchor="mm")
    draw.text((cx, 430), "NO CAMERA CONNECTED", font=font(17), fill=(140, 160, 176), anchor="mm")
    return image


def main() -> None:
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    for movement, accent in ACCENTS.items():
        path = FRAMES_DIR / f"{movement}.jpg"
        build(movement, accent).save(path, "JPEG", quality=82, optimize=True)
        print(f"wrote {path.relative_to(Path(__file__).resolve().parent.parent)}")


if __name__ == "__main__":
    main()
