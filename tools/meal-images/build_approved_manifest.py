#!/usr/bin/env python3
"""Materialize the deliberately reviewed phase-one meal-image approvals."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


# These decisions are intentionally sparse. A truthful fallback is preferable
# to a visually attractive but misleading dish photograph.
APPROVALS = {
    ("Scrambled Egg and Rice Plate", "File:Fried rice with egg (03-10-2021).jpg"): (
        "REPRESENTATIVE",
        "Fried egg served over a bowl of vegetable rice",
        "Egg and rice are clearly visible; preparation differs from the exact NutriMind recipe.",
    ),
    ("Pandesal, Egg and Tomato Breakfast", "File:Pinoy Pandesal.jpg"): (
        "REPRESENTATIVE",
        "Fresh Filipino pandesal rolls served on a plate",
        "Accurate pandesal representation; egg and tomato are not shown.",
    ),
    ("Banana Peanut Butter Oatmeal", "File:Oatmeal (1).jpg"): (
        "REPRESENTATIVE",
        "A bowl of cooked oatmeal with milk",
        "Accurate oatmeal base; banana and peanut butter are not shown.",
    ),
    ("Beef Rice Bowl with Cabbage", "File:Braised Beef Shin Rice Bowl - Tiger Bites Pig 2025-09-17.jpg"): (
        "REPRESENTATIVE",
        "A braised beef and vegetable rice bowl",
        "Accurate beef-rice-bowl category; garnish and preparation differ.",
    ),
    ("Pork Rice Bowl with Carrots", "File:Braised Pork Rice Bowl - Noodles Street 2025-10-15.jpg"): (
        "REPRESENTATIVE",
        "A braised pork rice bowl with vegetables",
        "Accurate pork-rice-bowl category; preparation differs.",
    ),
    ("Tuna Cucumber Rice Bowl", "File:Salmon & Tuna Poke Bowl (M) with Spicy Mayo sauce - Kitokito 2025-04-25.jpg"): (
        "REPRESENTATIVE",
        "A tuna, salmon, cucumber, and vegetable rice bowl",
        "Tuna, cucumber, vegetables, and rice are visible; the photo also contains salmon.",
    ),
    ("Tofu Vegetable Rice Bowl", "File:Salt & Pepper Tofu Rice Bowl - Tiger Bites Pig 2025-11-20.jpg"): (
        "REPRESENTATIVE",
        "A tofu and vegetable rice bowl",
        "Accurate tofu-rice-bowl category; seasoning and preparation differ.",
    ),
}

LICENSE_URL_FALLBACKS = {
    "Public domain": "https://creativecommons.org/publicdomain/mark/1.0/",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    with args.candidates.open(encoding="utf-8-sig", newline="") as stream:
        candidates = list(csv.DictReader(stream))

    indexed = {(row["meal_name"], row["source_title"]): row for row in candidates}
    approved: list[dict[str, str]] = []
    for key, (image_kind, alt_text, review_notes) in APPROVALS.items():
        if key not in indexed:
            raise RuntimeError(f"Approved candidate is absent from the generated manifest: {key}")
        row = dict(indexed[key])
        row.update(
            {
                "review_status": "APPROVED",
                "image_kind": image_kind,
                "alt_text": alt_text,
                "review_notes": review_notes,
                "license_url": row["license_url"] or LICENSE_URL_FALLBACKS.get(row["license"], ""),
            }
        )
        if row["license_url"].startswith("http://creativecommons.org/"):
            row["license_url"] = row["license_url"].replace("http://", "https://", 1)
        if row["license"] not in {"CC0", "Public domain", "CC BY 4.0", "CC BY-SA 4.0"}:
            raise RuntimeError(f"Unsupported license reached approvals: {row['license']}")
        if not row["creator"] or not row["source_page_url"] or not row["license_url"]:
            raise RuntimeError(f"Incomplete attribution for approved candidate: {key}")
        approved.append(row)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    fields = list(approved[0].keys())
    with args.output.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(approved)

    print(f"Wrote {len(approved)} visually reviewed approvals to {args.output}")


if __name__ == "__main__":
    main()
