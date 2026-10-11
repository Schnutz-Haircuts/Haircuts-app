#!/usr/bin/env python3
"""Build the app's data from a checkout of the Haircuts repository.

Reads hair-list.csv (latin-1, ';'-separated: country;dd/mm/yyyy;event;jpg1..jpg6),
groups events by country (newest first) and writes web/data/events.js, together
with the list of all visited countries from index_footer.html.
Copies the referenced photos into web/photos, shrinking any that are larger
than MAX_SIDE pixels so the app stays a reasonable size, plus one small photo
per country into web/thumbs for the globe.

Usage: python3 tools/build_data.py path/to/Haircuts
"""
import csv
import html
import json
import re
import shutil
import sys
from pathlib import Path

MAX_SIDE = 1600
THUMB_SIDE = 320
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

# Visited-countries list (index_footer.html) name -> world map name.
VISITED_MAP_NAMES = {
    "Bosnia and Herzegovina": "Bosnia and Herz.",
    "Brunei Darussalam": "Brunei",
    "Czech Republic": "Czechia",
    "Dominican Republic": "Dominican Rep.",
    "Holy See (Vatican City State)": "Vatican",
    "Korea, Republic": "South Korea",
    "North Macedonia": "Macedonia",
    "Swaziland": "eSwatini",
    "United States": "United States of America",
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
        # Shown when hovering over the country on the globe: the last photo of
        # the oldest haircut that has photos.
        with_photos = [e for e in c["events"] if e["photos"]]
        c["thumb"] = with_photos[-1]["photos"][-1] if with_photos else None
    data = sorted(countries.values(), key=lambda c: c["name"])

    # Every country with a haircut was visited, even if the footer list misses it.
    visited = read_visited(src / "index_footer.html")
    visited_maps = {v["map"] for v in visited}
    visited += [{"name": c["name"], "map": c["map"]} for c in data
                if c["map"] not in visited_maps]
    visited.sort(key=lambda v: v["name"])

    (out / "data").mkdir(parents=True, exist_ok=True)
    with open(out / "data" / "events.js", "w", encoding="utf-8") as f:
        f.write("window.HAIRCUTS = ")
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write(";\nwindow.VISITED = ")
        json.dump(visited, f, ensure_ascii=False, indent=1)
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

    thumbs_dir = out / "thumbs"
    thumbs_dir.mkdir(exist_ok=True)
    for c in data:
        if c["thumb"] and (src / c["thumb"]).exists():
            copy_photo(src / c["thumb"], thumbs_dir / c["thumb"], THUMB_SIDE)

    n_events = sum(len(c["events"]) for c in data)
    n_photos = sum(len(e["photos"]) for c in data for e in c["events"])
    print(f"{len(data)} countries, {n_events} events, {n_photos} photos, "
          f"{len(visited)} countries visited")
    if missing:
        sys.exit(f"Missing photos: {', '.join(missing)}")


def read_visited(path: Path) -> list:
    """The comma-separated country list in the last paragraph of index_footer.html."""
    text = path.read_text(encoding="latin-1")
    paragraph = re.findall(r"<p>([^<]+)</p>", text)[-1]
    names = []
    for part in html.unescape(paragraph).split(","):
        part = part.strip()
        if part == "Republic" and names:  # "Korea, Republic"
            names[-1] += ", Republic"
        elif part:
            names.append(part)
    return [{"name": n, "map": VISITED_MAP_NAMES.get(n, n)} for n in names]


def copy_photo(src: Path, dst: Path, max_side: int = MAX_SIDE) -> None:
    try:
        from PIL import Image, ImageOps
    except ImportError:
        shutil.copyfile(src, dst)
        return
    with Image.open(src) as im:
        if max(im.size) <= max_side:
            shutil.copyfile(src, dst)
            return
        im = ImageOps.exif_transpose(im)
        im.thumbnail((max_side, max_side))
        im.convert("RGB").save(dst, "JPEG", quality=JPEG_QUALITY)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]), Path(__file__).resolve().parent.parent / "web")
