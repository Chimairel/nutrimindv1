#!/usr/bin/env python3
"""Create a licensed Philippine-food source pool from a Commons campaign.

The pool is research input for expanding NutriMind from 51 to 100 canonical
meals. It does not approve, download, upload, or attach an image to a meal.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError


COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "NutriMindMealImageResearch/0.1 (educational capstone project)"
DEFAULT_CATEGORY = "Category:Images from Wiki Loves Food 2024 in the Philippines"
ALLOWED_LICENSE_PREFIXES = ("cc0", "public domain", "cc by ", "cc by-sa ")
CURATED_TITLES = (
    "File:Adobo Filipino style.jpg",
    "File:Adobong Manok with Laurel leaves.jpg",
    "File:ADOBONG MANOK SA SARSA.jpg",
    "File:Bacolod Inasal.jpg",
    "File:Beef bulalo meal.jpg",
    "File:Beef Caldereta.jpg",
    "File:Beef Kare-Kare 01.jpg",
    "File:Beef Pares.jpg",
    "File:Beef salpicao.jpg",
    "File:Beef steak and sunny side up.jpg",
    "File:Beef Tapa with Egg.jpg",
    "File:Bikol home made ginataang laing.jpg",
    "File:Chicken Ala max.jpg",
    "File:Chicken Cordon Bleu with Creamy Cheese Sauce.jpg",
    "File:Chicken grilled meal.jpg",
    "File:Chicken Hamonado.jpg",
    "File:Chicken Menudo.jpg",
    "File:Chicken Ngohiong.jpg",
    "File:Chicken Pastil.jpg",
    "File:Chicken Pork Laing.jpg",
    "File:Chicken Tenderloin Tips.jpg",
    "File:Chop suey.jpg",
    "File:Crab Fuyong.jpg",
    "File:Creamy Kare-Kare.jpg",
    "File:Creamy Mushroom Chicken.jpg",
    "File:Crispy Pancit Bato.jpg",
    "File:Ensaladang talbos ng kamote ,Tuyo at Pritong itlog.jpg",
    "File:Ensaladang talong.jpg",
    "File:Fish Fillet Fingers.jpg",
    "File:Fried Kikiam.jpg",
    "File:Fried rice fusion with siomai.jpg",
    "File:Ginataang Pinakbet with lambay(crab).jpg",
    "File:Ginataang tulingan with kangkong.jpg",
    "File:Graceland's Pinangat & Lumpiang Shanghai 01.jpg",
    "File:Grilled Bangus Fish.jpg",
    "File:Grilled Chicken Inasal.jpg",
    "File:Grilled fish, pork, and corn.jpg",
    "File:Grilled Pork and Java Rice.jpg",
    "File:Grilled Pork Belly.jpg",
    "File:Grilled Pork with Achara.jpg",
    "File:Home made chicken salad.jpg",
    "File:Home made fried tokwa with ala king.jpg",
    "File:Home made ginataang suso (snail).jpg",
    "File:Home made Palabok.jpg",
    "File:Home made Pork steak.jpg",
    "File:Home made Vegetable kare-kare.jpg",
    "File:Igado (Pork and Liver Stew).jpg",
    "File:Ilonngo Linugaw.jpg",
    "File:Inihaw na liempo.jpg",
    "File:Inunonan na bisugo.jpg",
    "File:Kare-kare in Minalabac.jpg",
    "File:Katuray Flower Salad.jpg",
    "File:KBL Ilocos Style.jpg",
    "File:Kinalas Series by Kitchen Everywhere.jpg",
    "File:Kwek kwek.jpg",
    "File:Lechon Pork Belly.jpg",
    "File:Long silog.jpg",
    "File:Lumpia sliced in half.jpg",
    "File:Lumpiaang Shanghai.jpg",
    "File:LumpiangSariwa.jpg",
    "File:Lutong Bahay; Ginataang tulingan.jpg",
    "File:Malunggay Pandesal.jpg",
    "File:Mang inasal, chicken inasal.jpg",
    "File:Masi (Peanut Stuffed Sticky Rice).jpg",
    "File:Max's Pancit Guisado 01.jpg",
    "File:Max's Sizzling Tofu Sisig.jpg",
    "File:Menudo on the Go!.jpg",
    "File:Mixed Seafood 2025.jpg",
    "File:Okoy na Puso ng Saging (Banana Blossom Patty) 01.jpg",
    "File:Palabok @ casa moderna.jpg",
    "File:Pan Bisaya.jpg",
    "File:Pancit Canton Guisado 1.jpg",
    "File:Pansit guisado.jpg",
    "File:Pansit Habhab of Quezon Province.jpg",
    "File:Pater is typically a combination of rice, meat (such as chicken or pork), and sometimes vegetables or other ingredients, which is steamed or boiled in the banana leaves.32949017920.jpg",
    "File:Pinoy Empanada.jpg",
    "File:Pinoy Kinilaw.jpg",
    "File:Poqui poqui.jpg",
    "File:Pork and Tofu Sisig.jpg",
    "File:Pork Inasal.jpg",
    "File:Pork Menudo (Filipino Pork Stew).jpg",
    "File:Pork Soup.jpg",
    "File:RECADO SA TINOLA.jpg",
    "File:Relyeno Bangus.jpg",
    "File:Savory Pork Dish.jpg",
    "File:Scrambled egg on plate.jpg",
    "File:Seafood shrimp and bibe shell with mais.jpg",
    "File:Silog.jpg",
    "File:Sinabawan karning baboy.jpg",
    "File:Sinigang sa hipon.jpg",
    "File:Siomai Rice.jpg",
    "File:Sisig Twist.jpg",
    "File:Sizzling tofu.jpg",
    "File:Spamsilog.jpg",
    "File:Special Goto.jpg",
    "File:Spicy Bicol Express.jpg",
    "File:Sunny-side up plating.jpg",
    "File:Sweet and sour bibi patty.jpg",
    "File:Sweet and Sour Bliss Banana Blossom Meat Sensation.jpg",
    "File:Sweet potato and lubi-lubi duchess.jpg",
    "File:The Akeanon Binakoe.jpg",
    "File:Tilapia Sinanglay Sizzling Sisig.jpg",
    "File:Tilapia steak and mashed bungkukan with lemon cream sauce.jpg",
    "File:Tilapia with salted black beans.jpg",
    "File:Tinapa Fried Rice 1.jpg",
    "File:TINOLANG MANOK.jpg",
    "File:Tinuktok.jpg",
    "File:Tofu Sisig.jpg",
    "File:Tokwa at Baboy.jpg",
    "File:Tokwa diet.jpg",
    "File:Topsilog.jpg",
    "File:Tropical White Chicken Adobo.jpg",
    "File:Vegetable Afritada.jpg",
    "File:Vegetable kare-kare.jpg",
    "File:Vegetable Lumpia with peanut sauce.jpg",
    "File:Vegetable Noodles.jpg",
    "File:Vegetables recipes needed for sinigang na baboy.jpg",
    "File:Vibrant Veggie Medley.jpg",
)


def api_json(params: dict[str, str]) -> dict[str, Any]:
    url = f"{COMMONS_API}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code != 429 or attempt == 4:
                raise
            retry_after = error.headers.get("Retry-After")
            delay = float(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt
            time.sleep(min(delay, 16))
    raise RuntimeError("Wikimedia Commons returned no response")


def strip_html(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    return html.unescape(re.sub(r"\s+", " ", value)).strip()


def metadata_value(metadata: dict[str, Any], key: str) -> str:
    raw = metadata.get(key, {})
    return strip_html(str(raw.get("value", ""))) if isinstance(raw, dict) else ""


def allowed_license(name: str) -> bool:
    normalized = name.strip().lower()
    return any(normalized.startswith(prefix) for prefix in ALLOWED_LICENSE_PREFIXES)


def chunks(values: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def normalized_title(title: str) -> str:
    value = re.sub(r"^File:", "", title, flags=re.IGNORECASE)
    value = re.sub(r"\.[A-Za-z0-9]+$", "", value)
    value = re.sub(r"\b(?:photo|image|plating|contest|project|dish|meal)\b", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\b(?:0?[1-9]|[1-9][0-9])\b", " ", value)
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def build_html(rows: list[dict[str, str]], output_path: Path) -> None:
    cards = []
    for row in rows:
        cards.append(
            f"""<article><a href="{html.escape(row['source_page_url'])}" target="_blank" rel="noreferrer"><span class="image-frame"><img loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'" src="{html.escape(row['thumbnail_url'])}" alt=""><span class="image-fallback">Preview unavailable<br>Open the source page</span></span></a><h2>{html.escape(row['source_title'])}</h2><p>{html.escape(row['creator'])}</p><p>{html.escape(row['license'])}</p></article>"""
        )
    output_path.write_text(
        """<!doctype html><html><head><meta charset="utf-8"><title>Philippine food source pool</title><style>body{font:14px system-ui;margin:24px;background:#f5f7f5;color:#13241d}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}article{background:white;padding:12px;border:1px solid #ccd8d0;border-radius:12px}.image-frame{display:grid;width:100%;height:170px;border-radius:8px;overflow:hidden;background:#e5ece7}.image-frame>*{grid-area:1/1}.image-frame img{width:100%;height:170px;object-fit:cover;z-index:1}.image-fallback{display:grid;place-items:center;text-align:center;padding:16px;color:#52645b;font-weight:650}h2{font-size:15px;overflow-wrap:anywhere}</style></head><body><h1>Philippine food source pool</h1><p>Research candidates only. Each asset still needs dish-accuracy and composition review before approval. If a remote preview is unavailable, use the source-page link on its card.</p><div class="grid">"""
        + "".join(cards)
        + "</div></body></html>",
        encoding="utf-8",
    )


def build_attribution_index(rows: list[dict[str, str]], output_path: Path) -> None:
    lines = [
        "# Candidate image attribution index",
        "",
        "These are research candidates, not approved NutriMind assets. Each source page is the canonical license record.",
        "",
    ]
    for row in rows:
        creator = row["creator"] or "Creator listed on source page"
        lines.append(
            f"{row['pool_rank']}. [{row['proposed_meal_name']}]({row['source_page_url']}) — {creator}; "
            f"[{row['license']}]({row['license_url']})."
        )
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--category", default=DEFAULT_CATEGORY)
    parser.add_argument("--target", type=int, default=100)
    args = parser.parse_args()
    if not 1 <= args.target <= 300:
        parser.error("--target must be between 1 and 300")

    listing = api_json(
        {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": args.category,
            "cmtype": "file",
            "cmlimit": "500",
            "format": "json",
            "formatversion": "2",
        }
    )
    titles = [item["title"] for item in listing.get("query", {}).get("categorymembers", [])]
    pages: list[dict[str, Any]] = []
    for title_chunk in chunks(titles, 50):
        payload = api_json(
            {
                "action": "query",
                "titles": "|".join(title_chunk),
                "prop": "imageinfo",
                "iiprop": "url|size|mime|extmetadata",
                "iiurlwidth": "640",
                "format": "json",
                "formatversion": "2",
            }
        )
        pages.extend(payload.get("query", {}).get("pages", []))

    rows: list[dict[str, str]] = []
    seen_names: set[str] = set()
    pages_by_title = {str(page.get("title", "")): page for page in pages}
    missing_curated_titles = [title for title in CURATED_TITLES if title not in pages_by_title]
    for curated_title in CURATED_TITLES:
        page = pages_by_title.get(curated_title)
        if page is None:
            continue
        title = str(page.get("title", ""))
        dedupe_key = normalized_title(title)
        if not dedupe_key or dedupe_key in seen_names:
            continue
        image_info = (page.get("imageinfo") or [{}])[0]
        metadata = image_info.get("extmetadata") or {}
        license_name = metadata_value(metadata, "LicenseShortName")
        width = int(image_info.get("width") or 0)
        height = int(image_info.get("height") or 0)
        mime_type = str(image_info.get("mime", ""))
        if not allowed_license(license_name) or not mime_type.startswith("image/"):
            continue
        if width < 900 or height < 600:
            continue
        seen_names.add(dedupe_key)
        rows.append(
            {
                "pool_rank": str(len(rows) + 1),
                "proposed_meal_name": re.sub(r"^File:|\.[A-Za-z0-9]+$", "", title),
                "review_status": "NEEDS_VISUAL_AND_CATALOGUE_REVIEW",
                "provider": "WIKIMEDIA_COMMONS",
                "source_title": title,
                "source_page_url": str(image_info.get("descriptionurl", "")),
                "original_url": str(image_info.get("url", "")),
                "thumbnail_url": str(image_info.get("thumburl", "")),
                "creator": metadata_value(metadata, "Artist"),
                "credit": metadata_value(metadata, "Credit"),
                "license": license_name,
                "license_url": metadata_value(metadata, "LicenseUrl"),
                "attribution_required": metadata_value(metadata, "AttributionRequired"),
                "width": str(width),
                "height": str(height),
                "description": metadata_value(metadata, "ImageDescription"),
                "catalogue_fit_notes": "",
            }
        )
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output_csv = args.output_dir / "philippine-food-source-pool.csv"
    if rows:
        with output_csv.open("w", encoding="utf-8-sig", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
    build_html(rows, args.output_dir / "philippine-food-source-pool-review.html")
    build_attribution_index(rows, args.output_dir / "CANDIDATE_ATTRIBUTIONS.md")
    (args.output_dir / "source-pool-run-report.json").write_text(
        json.dumps(
            {
                "sourceCategory": args.category,
                "sourceFileCount": len(titles),
                "curatedTitleCount": len(CURATED_TITLES),
                "missingCuratedTitles": missing_curated_titles,
                "eligibleUniqueCandidateCount": len(rows),
                "requestedTarget": args.target,
                "targetReached": len(rows) >= args.target,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    if len(rows) < args.target:
        raise SystemExit(f"Only {len(rows)} eligible unique candidates were found for target {args.target}")


if __name__ == "__main__":
    main()
