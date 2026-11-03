#!/usr/bin/env python3
"""Bake the ghost-in-the-machine index into public/experiments.json.

Reads the published Pages index (one <li> per night; see ghost-in-the-machine's
scripts/build-index.py) and writes an array of {date, folder, title, lang, url}
for the Demos section. Run in CI before the build, so the site never fetches
across origins at run time and survives a Pages blip: on any error the last
file (or an empty list) is written and the build continues.
"""
import html
import json
import pathlib
import re
import sys
import urllib.request

INDEX = "https://petterfranzen.github.io/ghost-in-the-machine/"
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "experiments.json"
ITEM = re.compile(
    r'<li><a href="(?P<folder>[^"]+)/">.*?<span class="d">(?P<date>[^<]*)</span>'
    r'<span class="i">(?P<title>[^<]*)</span><span class="l">(?P<lang>[^<]*)</span></a>',
    re.S,
)


def main() -> int:
    try:
        with urllib.request.urlopen(INDEX, timeout=20) as r:
            page = r.read().decode("utf-8", "replace")
    except Exception as exc:  # noqa: BLE001 - best effort by design
        print(f"build-experiments: {exc}; writing an empty list", file=sys.stderr)
        page = ""
    items = [
        {
            "date": html.unescape(m.group("date")),
            "folder": html.unescape(m.group("folder")),
            "title": html.unescape(m.group("title")),
            "lang": html.unescape(m.group("lang")),
            "url": INDEX + html.unescape(m.group("folder")) + "/",
        }
        for m in ITEM.finditer(page)
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(items, indent=2) + "\n", encoding="utf-8")
    print(f"build-experiments: {len(items)} item(s) -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
