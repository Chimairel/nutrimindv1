#!/usr/bin/env python3
"""Find licensed Commons candidates for the consumption-first photo backlog."""

from __future__ import annotations

import argparse
import csv
import html
import json
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError

from build_commons_candidates import allowed_license, metadata_value


COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "NutriMindMealImageResearch/0.2 (educational capstone project)"


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


def chunks(values: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def search_titles(subject: str, limit: int) -> list[str]:
    payload = api_json(
        {
            "action": "query",
            "list": "search",
            "srsearch": f"{subject} food",
            "srnamespace": "6",
            "srlimit": str(limit),
            "format": "json",
            "formatversion": "2",
        }
    )
    return [row["title"] for row in payload.get("query", {}).get("search", [])]


def fetch_metadata(titles: list[str]) -> dict[str, dict[str, Any]]:
    pages: dict[str, dict[str, Any]] = {}
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
        for page in payload.get("query", {}).get("pages", []):
            pages[str(page.get("title", ""))] = page
    return pages


def eligible(page: dict[str, Any]) -> bool:
    info = (page.get("imageinfo") or [{}])[0]
    metadata = info.get("extmetadata") or {}
    return (
        str(info.get("mime", "")).startswith("image/")
        and int(info.get("width") or 0) >= 900
        and int(info.get("height") or 0) >= 600
        and allowed_license(metadata_value(metadata, "LicenseShortName"))
    )


def output_row(subject: dict[str, str], page: dict[str, Any] | None, error: str = "") -> dict[str, str]:
    base = {
        "priority": subject["priority"],
        "photo_subject": subject["photo_subject"],
        "coverage_group": subject["coverage_group"],
        "consumption_anchor": subject["consumption_anchor"],
        "evidence_tier": subject["evidence_tier"],
    }
    if page is None:
        return {
            **base,
            "review_status": "NO_LICENSED_CANDIDATE",
            "provider": "WIKIMEDIA_COMMONS",
            "source_title": "",
            "source_page_url": "",
            "original_url": "",
            "thumbnail_url": "",
            "creator": "",
            "license": "",
            "license_url": "",
            "width": "",
            "height": "",
            "search_notes": error,
        }
    info = (page.get("imageinfo") or [{}])[0]
    metadata = info.get("extmetadata") or {}
    return {
        **base,
        "review_status": "NEEDS_VISUAL_REVIEW",
        "provider": "WIKIMEDIA_COMMONS",
        "source_title": str(page.get("title", "")),
        "source_page_url": str(info.get("descriptionurl", "")),
        "original_url": str(info.get("url", "")),
        "thumbnail_url": str(info.get("thumburl", "")),
        "creator": metadata_value(metadata, "Artist"),
        "license": metadata_value(metadata, "LicenseShortName"),
        "license_url": metadata_value(metadata, "LicenseUrl"),
        "width": str(info.get("width") or ""),
        "height": str(info.get("height") or ""),
        "search_notes": error,
    }


def build_html(rows: list[dict[str, str]], output_path: Path) -> None:
    cards = []
    for row in rows:
        if not row["thumbnail_url"]:
            preview = '<span class="image-frame"><span class="image-fallback">No licensed candidate found</span></span>'
            link_start = ""
            link_end = ""
        else:
            preview = f"""<span class="image-frame"><img loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'" src="{html.escape(row['thumbnail_url'])}" alt=""><span class="image-fallback">Preview unavailable<br>Open the source page</span></span>"""
            link_start = f"<a href=\"{html.escape(row['source_page_url'])}\" target=\"_blank\" rel=\"noreferrer\">"
            link_end = "</a>"
        cards.append(
            f"<article>{link_start}{preview}{link_end}<h2>{html.escape(row['photo_subject'])}</h2><p>{html.escape(row['source_title'] or row['review_status'])}</p><p>{html.escape(row['creator'])} · {html.escape(row['license'])}</p></article>"
        )
    output_path.write_text(
        """<!doctype html><html><head><meta charset="utf-8"><title>Consumption-first candidates</title><style>body{font:14px system-ui;margin:24px;background:#f5f7f5;color:#13241d}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}article{background:white;padding:12px;border:1px solid #ccd8d0;border-radius:12px}.image-frame{display:grid;width:100%;height:170px;border-radius:8px;overflow:hidden;background:#e5ece7}.image-frame>*{grid-area:1/1}.image-frame img{width:100%;height:170px;object-fit:cover;z-index:1}.image-fallback{display:grid;place-items:center;text-align:center;padding:16px;color:#52645b;font-weight:650}h2{font-size:15px}p{overflow-wrap:anywhere}</style></head><body><h1>Consumption-first image candidates</h1><p>Automated candidates only. Approve only when the photograph accurately depicts the named preparation.</p><div class="grid">"""
        + "".join(cards)
        + "</div></body></html>",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--subjects", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--search-limit", type=int, default=5)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--max-subjects", type=int)
    args = parser.parse_args()
    with args.subjects.open(encoding="utf-8-sig", newline="") as stream:
        subjects = list(csv.DictReader(stream))
    if args.max_subjects is not None:
        if args.max_subjects < 1:
            parser.error("--max-subjects must be positive")
        subjects = subjects[: args.max_subjects]

    searches: dict[str, list[str]] = {}
    failures: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(search_titles, subject["photo_subject"], args.search_limit): subject["photo_subject"]
            for subject in subjects
        }
        for future in as_completed(futures):
            subject_name = futures[future]
            try:
                searches[subject_name] = future.result()
            except Exception as error:
                searches[subject_name] = []
                failures[subject_name] = str(error)

    unique_titles = list(dict.fromkeys(title for titles in searches.values() for title in titles))
    metadata = fetch_metadata(unique_titles)
    rows = []
    for subject in subjects:
        subject_name = subject["photo_subject"]
        selected = next((metadata[title] for title in searches[subject_name] if title in metadata and eligible(metadata[title])), None)
        rows.append(output_row(subject, selected, failures.get(subject_name, "")))

    args.output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = args.output_dir / "consumption-first-image-candidates.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    build_html(rows, args.output_dir / "consumption-first-image-candidate-review.html")
    found = sum(row["review_status"] == "NEEDS_VISUAL_REVIEW" for row in rows)
    (args.output_dir / "consumption-candidate-run-report.json").write_text(
        json.dumps(
            {
                "subjectCount": len(subjects),
                "licensedCandidateCount": found,
                "noCandidateCount": len(rows) - found,
                "searchFailureCount": len(failures),
                "searchFailures": failures,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
