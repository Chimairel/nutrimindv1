#!/usr/bin/env python3
"""Build a reviewable Wikimedia Commons image-candidate manifest.

This script intentionally does not download or approve images. It extracts the
canonical NutriMind meal names, queries Commons, keeps only allow-listed free
licenses, and writes metadata that a human can review before Cloudinary upload.
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
from urllib.error import HTTPError
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any


COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "NutriMindMealImageResearch/0.1 (educational capstone project)"
ALLOWED_LICENSE_PREFIXES = (
    "cc0",
    "public domain",
    "cc by ",
    "cc by-sa ",
)

QUERY_HINTS = (
    ("pandesal", "pandesal Filipino bread"),
    ("munggo", "ginisang munggo Filipino food"),
    ("tokwa", "tokwa Filipino tofu food"),
    ("milkfish", "bangus Filipino food"),
    ("tilapia", "tilapia Filipino food"),
    ("sardines", "sardines rice Filipino food"),
    ("tuna", "tuna rice bowl food"),
    ("tofu", "tofu rice bowl food"),
    ("chicken", "chicken rice bowl food"),
    ("beef", "beef rice bowl food"),
    ("pork", "pork rice bowl food"),
    ("egg", "egg rice Filipino food"),
    ("sweet potato", "sweet potato meal food"),
    ("corn", "corn meal food"),
    ("oatmeal", "oatmeal bowl food"),
)


@dataclass(frozen=True)
class Meal:
    name: str
    meal_type: str


def strip_html(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    return html.unescape(re.sub(r"\s+", " ", value)).strip()


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or "meal"


def extract_meals(catalogue_path: Path) -> list[Meal]:
    source = catalogue_path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"mealName:\s*'(?P<name>[^']+)'[\s\S]*?mealType:\s*'(?P<type>BREAKFAST|LUNCH|DINNER)'"
    )
    meals = [Meal(match.group("name"), match.group("type")) for match in pattern.finditer(source)]
    if not meals:
        raise RuntimeError(f"No canonical meals found in {catalogue_path}")
    if len({meal.name for meal in meals}) != len(meals):
        raise RuntimeError("Canonical catalogue contains duplicate meal names")
    return meals


def search_query(meal_name: str) -> str:
    lowered = meal_name.lower()
    for token, query in QUERY_HINTS:
        if token in lowered:
            return query
    return f"{meal_name} food"


def fallback_category(meal: Meal) -> str:
    lowered = meal.name.lower()
    if any(token in lowered for token in ("milkfish", "bangus", "tilapia", "tuna", "sardines")):
        return "seafood"
    if any(token in lowered for token in ("chicken", "egg")):
        return "poultry-and-egg"
    if any(token in lowered for token in ("beef", "pork")):
        return "red-meat"
    if any(token in lowered for token in ("tofu", "tokwa", "munggo", "vegetable")):
        return "plant-based"
    return meal.meal_type.lower()


def metadata_value(metadata: dict[str, Any], key: str) -> str:
    raw = metadata.get(key, {})
    return strip_html(str(raw.get("value", ""))) if isinstance(raw, dict) else ""


def allowed_license(name: str) -> bool:
    normalized = name.strip().lower()
    return any(normalized.startswith(prefix) for prefix in ALLOWED_LICENSE_PREFIXES)


def fetch_candidates(meal: Meal, limit: int) -> list[dict[str, str]]:
    query = search_query(meal.name)
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": "6",
        "gsrlimit": str(limit),
        "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": "640",
        "format": "json",
        "formatversion": "2",
    }
    url = f"{COMMONS_API}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    payload: dict[str, Any] | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                payload = json.load(response)
            break
        except HTTPError as error:
            if error.code != 429 or attempt == 4:
                raise
            retry_after = error.headers.get("Retry-After")
            delay = float(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt
            time.sleep(min(delay, 16))
    if payload is None:
        raise RuntimeError("Wikimedia Commons returned no response")

    candidates: list[dict[str, str]] = []
    pages = payload.get("query", {}).get("pages", [])
    for page in sorted(pages, key=lambda item: item.get("index", 999)):
        image_info = (page.get("imageinfo") or [{}])[0]
        metadata = image_info.get("extmetadata") or {}
        license_name = metadata_value(metadata, "LicenseShortName")
        mime_type = str(image_info.get("mime", ""))
        if not allowed_license(license_name) or not mime_type.startswith("image/"):
            continue
        width = int(image_info.get("width") or 0)
        height = int(image_info.get("height") or 0)
        if width < 640 or height < 400:
            continue
        candidates.append(
            {
                "meal_name": meal.name,
                "meal_type": meal.meal_type,
                "asset_key": f"meal/{slugify(meal.name)}",
                "fallback_category": fallback_category(meal),
                "search_query": query,
                "candidate_rank": str(len(candidates) + 1),
                "review_status": "NEEDS_VISUAL_REVIEW",
                "provider": "WIKIMEDIA_COMMONS",
                "source_title": str(page.get("title", "")),
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
                "review_notes": "",
            }
        )
    return candidates


def build_contact_sheet(rows: list[dict[str, str]], output_path: Path) -> None:
    cards = []
    grouped: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        grouped.setdefault(row["meal_name"], []).append(row)
    for meal_name, candidates in grouped.items():
        candidate_cards = []
        for row in candidates:
            candidate_cards.append(
                f"""
                <article class="candidate">
                  <a href="{html.escape(row['source_page_url'])}" target="_blank" rel="noreferrer">
                    <img src="{html.escape(row['thumbnail_url'])}" alt="{html.escape(row['description'] or row['source_title'])}">
                  </a>
                  <p><strong>#{row['candidate_rank']} {html.escape(row['source_title'])}</strong></p>
                  <p>{html.escape(row['creator'])} · {html.escape(row['license'])}</p>
                </article>
                """
            )
        cards.append(
            f"<section><h2>{html.escape(meal_name)}</h2><div class='grid'>{''.join(candidate_cards) or '<p>No eligible candidates found.</p>'}</div></section>"
        )
    output_path.write_text(
        """<!doctype html><html><head><meta charset="utf-8"><title>NutriMind image candidates</title>
        <style>body{font:14px system-ui;margin:24px;background:#f5f7f5;color:#13241d}section{margin:0 0 36px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.candidate{background:white;padding:12px;border:1px solid #ccd8d0;border-radius:12px}.candidate img{width:100%;height:160px;object-fit:cover;border-radius:8px}.candidate p{margin:8px 0 0;overflow-wrap:anywhere}</style>
        </head><body><h1>NutriMind Wikimedia Commons candidates</h1><p>Every item still requires visual approval. Clicking an image opens its source and license page.</p>"""
        + "".join(cards)
        + "</body></html>",
        encoding="utf-8",
    )


def write_canonical_inventory(meals: list[Meal], output_path: Path) -> None:
    fields = [
        "meal_name",
        "meal_type",
        "asset_key",
        "fallback_category",
        "preferred_search_query",
        "assignment_status",
        "selected_source_page_url",
        "selected_source_title",
        "display_label_when_representative",
        "review_notes",
    ]
    with output_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for meal in meals:
            writer.writerow(
                {
                    "meal_name": meal.name,
                    "meal_type": meal.meal_type,
                    "asset_key": f"meal/{slugify(meal.name)}",
                    "fallback_category": fallback_category(meal),
                    "preferred_search_query": search_query(meal.name),
                    "assignment_status": "UNASSIGNED",
                    "selected_source_page_url": "",
                    "selected_source_title": "",
                    "display_label_when_representative": "Representative image",
                    "review_notes": "",
                }
            )


def write_placeholder_inventory(output_path: Path) -> None:
    rows = [
        ("breakfast", "Representative breakfast image"),
        ("lunch", "Representative lunch image"),
        ("dinner", "Representative dinner image"),
        ("seafood", "Representative seafood meal image"),
        ("poultry-and-egg", "Representative poultry or egg meal image"),
        ("red-meat", "Representative meat meal image"),
        ("plant-based", "Representative plant-based meal image"),
    ]
    fields = ["fallback_key", "alt_text", "planned_asset_path", "status"]
    with output_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for key, alt_text in rows:
            writer.writerow(
                {
                    "fallback_key": key,
                    "alt_text": alt_text,
                    "planned_asset_path": f"frontend/public/images/meals/fallback/{key}.webp",
                    "status": "TO_BE_DESIGNED",
                }
            )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalogue", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=4)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--inventory-only", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.limit <= 10:
        parser.error("--limit must be between 1 and 10")
    if not 1 <= args.workers <= 6:
        parser.error("--workers must be between 1 and 6")

    meals = extract_meals(args.catalogue)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_canonical_inventory(meals, args.output_dir / "canonical-meal-image-inventory.csv")
    write_placeholder_inventory(args.output_dir / "placeholder-asset-plan.csv")
    if args.inventory_only:
        (args.output_dir / "candidate-run-report.json").write_text(
            json.dumps(
                {
                    "canonicalMealCount": len(meals),
                    "candidateSearchSkipped": True,
                    "reason": "inventory-only run",
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        return
    rows: list[dict[str, str]] = []
    failures: list[str] = []
    started_at = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(fetch_candidates, meal, args.limit): meal for meal in meals}
        for future in as_completed(futures):
            meal = futures[future]
            try:
                rows.extend(future.result())
            except Exception as error:  # The report must preserve partial progress.
                failures.append(f"{meal.name}: {error}")

    meal_order = {meal.name: index for index, meal in enumerate(meals)}
    rows.sort(key=lambda row: (meal_order[row["meal_name"]], int(row["candidate_rank"])))
    manifest_path = args.output_dir / "wikimedia-candidates.csv"
    fields = list(rows[0].keys()) if rows else ["meal_name", "review_status"]
    with manifest_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    build_contact_sheet(rows, args.output_dir / "wikimedia-candidate-review.html")
    (args.output_dir / "candidate-run-report.json").write_text(
        json.dumps(
            {
                "canonicalMealCount": len(meals),
                "candidateCount": len(rows),
                "mealsWithCandidates": len({row["meal_name"] for row in rows}),
                "failures": failures,
                "elapsedSeconds": round(time.time() - started_at, 2),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    if failures:
        raise SystemExit(f"Completed with {len(failures)} failed searches; see candidate-run-report.json")


if __name__ == "__main__":
    main()
