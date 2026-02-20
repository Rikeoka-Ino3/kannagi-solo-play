#!/usr/bin/env python3
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

CARDS_JS_URL = "https://hanil524.github.io/kannagi-cardlist/cards.js"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "cards-master.json"


def extract_cards_html(source: str) -> str:
    marker = "window.__CARDS_HTML = `"
    start = source.find(marker)
    if start < 0:
        raise RuntimeError("window.__CARDS_HTML not found")
    body_start = start + len(marker)
    body_end = source.find("`;", body_start)
    if body_end < 0:
        raise RuntimeError("template literal end not found")
    return source[body_start:body_end]


def parse_data_attrs(tag_text: str) -> dict[str, str]:
    attrs = {}
    for key, value in re.findall(r'data-([a-zA-Z0-9_-]+)="([^"]*)"', tag_text):
        attrs[key] = value
    return attrs


def parse_cards(cards_html: str) -> list[dict[str, str]]:
    cards = []
    for card_block in re.findall(r'<div\s+class="card"[\s\S]*?</div>', cards_html):
        attrs = parse_data_attrs(card_block)
        number = str(attrs.get("number", "")).strip()
        if not number:
            continue

        img_match = re.search(r'<img[^>]*(?:data-src|src)="([^"]+)"[^>]*>', card_block)
        raw_src = img_match.group(1) if img_match else ""
        if raw_src.startswith("http"):
            image = raw_src
        else:
            image = (
                "https://hanil524.github.io/kannagi-cardlist/"
                + re.sub(r"^\.?/", "", raw_src)
            )

        cards.append(
            {
                "number": number,
                "name": attrs.get("name") or f"No.{number}",
                "type": attrs.get("type") or "不明",
                "image": image,
            }
        )

    cards.sort(key=lambda c: int(c["number"]))
    return cards


def main() -> None:
    with urlopen(CARDS_JS_URL) as res:  # nosec B310
        source = res.read().decode("utf-8")
    html = extract_cards_html(source)
    cards = parse_cards(html)
    if not cards:
        raise RuntimeError("no cards parsed")

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": CARDS_JS_URL,
        "count": len(cards),
        "cards": cards,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"cards-master.json generated: {len(cards)} cards")


if __name__ == "__main__":
    main()
