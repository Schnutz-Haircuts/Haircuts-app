#!/usr/bin/env python3
"""Build the app's data from a checkout of the Haircuts repository.

Reads hair-list.csv (latin-1, ';'-separated: country;dd/mm/yyyy;event;jpg1..jpg6),
groups events by country (newest first) and writes web/data/events.js.
Copies the referenced photos into web/photos, shrinking any that are larger
than MAX_SIDE pixels so the app stays a reasonable size.

Usage: python3 tools/build_data.py path/to/Haircuts
"""
import csv
import json
import shutil
import sys
from pathlib import Path

MAX_SIDE = 1600
JPEG_QUALITY = 85

# CSV country name -> country name in the world map (Natural Earth, 1:50m).
MAP_NAMES = {
    "Bosnia and Herzegovina": "Bosnia and Herz.",
    "Czech Republic": "Czechia",
    "Dominican Republic": "Dominican Rep.",
    "Finnland": "Finland",
    "Korea": "South Korea",
    "North Macedonia": "Macedonia",
    "Palestinian National Authority": "Palestine",
}

# Spelling fixes for the name shown in the app.
DISPLAY_NAMES = {"Finnland": "Finland"}


def main(src: Path, out: Path) -> None:
    with open(src / "hair-list.csv", encoding="latin-1", newline="") as f:
        rows = [r for r in csv.reader(f, delimiter=";") if r and r[0].strip()]

    countries = {}
    for r in rows:
        name = r[0].strip()
        d, m, y = r[1].strip().split("/")
        c = countries.setdefault(name, {
            "name": DISPLAY_NAMES.get(name, name),
            "map": MAP_NAMES.get(name, name),
            "events": [],
        })
        c["events"].append({
            "date": f"{y}-{m}-{d}",
            "text": r[2].strip(),
            "photos": [j.strip() for j in r[3:] if j.strip()],
        })

    for c in countries.values():
        c["events"].sort(key=lambda e: e["date"], reverse=True)
    data = sorted(countries.values(), key=lambda c: c["name"])

    (out / "data").mkdir(parents=True, exist_ok=True)
    with open(out / "data" / "events.js", "w", encoding="utf-8") as f:
        f.write("window.HAIRCUTS = ")
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write(";\n")

    photos_dir = out / "photos"
    photos_dir.mkdir(exist_ok=True)
    missing = []
    for c in data:
        for e in c["events"]:
            for p in e["photos"]:
                if (src / p).exists():
                    copy_photo(src / p, photos_dir / p)
                else:
                    missing.append(p)

    n_events = sum(len(c["events"]) for c in data)
    n_photos = sum(len(e["photos"]) for c in data for e in c["events"])
    print(f"{len(data)} countries, {n_events} events, {n_photos} photos")
    if missing:
        sys.exit(f"Missing photos: {', '.join(missing)}")


def copy_photo(src: Path, dst: Path) -> None:
    try:
        from PIL import Image, ImageOps
    except ImportError:
        shutil.copyfile(src, dst)
        return
    with Image.open(src) as im:
        if max(im.size) <= MAX_SIDE:
            shutil.copyfile(src, dst)
            return
        im = ImageOps.exif_transpose(im)
        im.thumbnail((MAX_SIDE, MAX_SIDE))
        im.convert("RGB").save(dst, "JPEG", quality=JPEG_QUALITY)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]), Path(__file__).resolve().parent.parent / "web")
