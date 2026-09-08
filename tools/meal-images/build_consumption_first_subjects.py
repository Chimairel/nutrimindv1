#!/usr/bin/env python3
"""Build the evidence-led photo-subject backlog for NutriMind meal images."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


GROUPS = {
    "rice-and-staples": [
        "Steamed white rice",
        "Garlic fried rice",
        "Plain fried rice",
        "Egg fried rice",
        "Rice with soy sauce",
        "Arroz caldo",
        "Chicken lugaw",
        "Goto rice porridge",
        "Champorado",
        "Instant noodles with egg",
        "Pancit canton with vegetables",
        "Pancit bihon",
        "Filipino-style spaghetti",
        "Pandesal",
        "Pande monay",
        "Steamed corn",
    ],
    "egg-and-breakfast": [
        "Fried egg",
        "Scrambled eggs",
        "Boiled egg",
        "Plain omelette",
        "Egg and rice plate",
        "Egg pandesal sandwich",
        "Hotdog, egg and rice",
        "Longsilog",
        "Tapsilog",
        "Tocilog",
        "Corned beef silog",
        "Tuna omelette",
        "Tortang talong",
        "Peanut butter pandesal",
        "Banana oatmeal",
    ],
    "pork-and-beef": [
        "Lean pork and rice",
        "Pork adobo and rice",
        "Sinigang na baboy",
        "Pork menudo and rice",
        "Nilagang baboy",
        "Pork chop and rice",
        "Grilled liempo and rice",
        "Inihaw na baboy",
        "Tocino and rice",
        "Longganisa and rice",
        "Hotdog and rice",
        "Pork sisig and rice",
        "Bistek Tagalog and rice",
        "Beef tapa and rice",
        "Beef nilaga",
        "Beef caldereta and rice",
        "Pork giniling and rice",
    ],
    "chicken": [
        "Fried chicken and rice",
        "Chicken adobo and rice",
        "Tinolang manok",
        "Chicken inasal and rice",
        "Chicken afritada and rice",
        "Chicken curry and rice",
        "Grilled chicken and rice",
        "Chicken vegetable soup",
        "Chicken sandwich",
        "Chicken macaroni soup",
        "Chicken and vegetable stir-fry",
        "Chicken, potato and carrot stew",
        "Roast chicken and rice",
    ],
    "fish-and-seafood": [
        "Fried galunggong and rice",
        "Grilled galunggong and rice",
        "Grilled bangus and rice",
        "Fried bangus and rice",
        "Daing na bangus and rice",
        "Paksiw na bangus",
        "Rellenong bangus and rice",
        "Fried tilapia and rice",
        "Grilled tilapia and rice",
        "Paksiw na tilapia",
        "Canned sardines in tomato sauce with rice",
        "Sardines, egg and rice",
        "Tuna rice bowl",
        "Tuna sandwich",
        "Dried fish, egg and rice",
        "Sinigang na hipon",
        "Grilled fish, vegetables and rice",
        "Fish soup and rice",
    ],
    "vegetables-and-legumes": [
        "Ginisang munggo and rice",
        "Munggo with malunggay",
        "Pinakbet and rice",
        "Chop suey and rice",
        "Ensaladang talong",
        "Ginataang kalabasa at sitaw",
        "Sauteed pechay and rice",
        "Cabbage and carrot stir-fry",
        "Okra and tomato",
        "Malunggay vegetable soup",
        "Ginisang sayote",
        "Tofu and vegetables with rice",
        "Tokwa and rice",
        "Vegetable fried rice",
        "Boiled sweet potato",
    ],
    "common-global-light-meals": [
        "Ham and cheese sandwich",
        "Peanut butter sandwich",
        "Burger",
        "Breakfast cereal with milk",
        "Plain oatmeal",
        "Fruit and yogurt bowl",
    ],
}

ANCHORS = {
    "rice-and-staples": "rice; pandesal; pande monay; instant noodles; corn",
    "egg-and-breakfast": "chicken egg; pandesal; hotdog",
    "pork-and-beef": "lean pork; pork belly/liempo; hotdog",
    "chicken": "white chicken meat",
    "fish-and-seafood": "galunggong; bangus; tilapia; canned sardines; tuna; tuyong tamban",
    "vegetables-and-legumes": "talong; malunggay; sitaw; kalabasa; carrot; repolyo; okra; dahon ng kamote",
    "common-global-light-meals": "contextual urban/common-food coverage; not claimed as a 2021 top-food ranking",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    subjects = [(group, subject) for group, values in GROUPS.items() for subject in values]
    if len(subjects) != 100:
        raise RuntimeError(f"Expected exactly 100 subjects, found {len(subjects)}")
    if len({subject.lower() for _, subject in subjects}) != len(subjects):
        raise RuntimeError("Duplicate consumption-first subjects found")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "priority",
        "photo_subject",
        "coverage_group",
        "consumption_anchor",
        "evidence_tier",
        "image_status",
        "selected_source_page_url",
        "review_notes",
    ]
    with args.output.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for index, (group, subject) in enumerate(subjects, start=1):
            evidence_tier = "SECONDARY_CONTEXTUAL" if group == "common-global-light-meals" else "FNRI_ANCHORED_DERIVATION"
            writer.writerow(
                {
                    "priority": index,
                    "photo_subject": subject,
                    "coverage_group": group,
                    "consumption_anchor": ANCHORS[group],
                    "evidence_tier": evidence_tier,
                    "image_status": "IMAGE_SEARCH_PENDING",
                    "selected_source_page_url": "",
                    "review_notes": "",
                }
            )


if __name__ == "__main__":
    main()
