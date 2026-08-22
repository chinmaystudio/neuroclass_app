from pathlib import Path

from PIL import Image


project = Path(__file__).resolve().parent.parent
asset_dir = project / "assets" / "images"
source = asset_dir / "icon.png"
targets = [
    asset_dir / "icon.png",
    asset_dir / "splash-icon.png",
    asset_dir / "favicon.png",
    asset_dir / "android-icon-foreground.png",
]

with Image.open(source) as image:
    optimized = image.convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
    for target in targets:
        optimized.save(target, format="PNG", optimize=True, compress_level=9)
        print(f"Optimized {target.name}: {target.stat().st_size} bytes")
