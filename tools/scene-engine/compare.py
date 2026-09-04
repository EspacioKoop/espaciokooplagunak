"""A/B scene-only differences; excludes DOM, borders and the screen-sprite band.

OTACON Astra. Optional evidence helper: python3 -m pip install Pillow.
Run from any directory: python3 tools/scene-engine/compare.py
"""
import json
from pathlib import Path

from PIL import Image, ImageChops

OUTPUT = Path(__file__).resolve().parent / "output"


def scene_image(name, backend):
    image = Image.open(OUTPUT / f"{name}-{backend}.png").convert("RGB")
    width, height = image.size
    scale = max(1, min((width - 2) // 320, (height - 2) // 180))
    left = 1 + (width - 2 - 320 * scale) // 2
    top = 1 + (height - 2 - 180 * scale) // 2
    return image.crop((left, top, left + 320 * scale, top + 140 * scale)).resize(
        (320, 140), Image.Resampling.NEAREST
    )


def difference(a, b):
    diff = ImageChops.difference(a, b)
    return {
        "changedScenePixels": sum(pixel != (0, 0, 0) for pixel in diff.getdata()),
        "scenePixels": 320 * 140,
        "bbox": diff.getbbox(),
    }


def main():
    result = {}
    for name in ("entrance", "bar", "side"):
        result[name] = difference(scene_image(name, "software"), scene_image(name, "gpu"))
    for name in ("bar", "side"):
        result[f"camera-entrance-to-{name}"] = difference(
            scene_image("entrance", "gpu"), scene_image(name, "gpu")
        )
    text = json.dumps(result, indent=2) + "\n"
    (OUTPUT / "pixel-diff.json").write_text(text)
    print(text)


if __name__ == "__main__":
    main()
