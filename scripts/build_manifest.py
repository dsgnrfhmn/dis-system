#!/usr/bin/env python3
"""Regenerate components/manifest.json and the per-category component
galleries in index.html from components/*/meta.json. See WORKFLOW.md step 8 and CLAUDE.md.

Both outputs are a strict function of the meta.json files: nothing here is
hand-curated. A component appears in its category's gallery the moment its
meta.json exists, validates, and carries that category -- there is no
separate opt-in list, and components/manifest.json is the single
machine-readable index of everything in the system (see CLAUDE.md:
"machine-readability is as important as visual output").

Each component's meta.json `category` field picks which card of index.html
its preview is listed under -- one id per component card of the Figma
D_SYSTEM web-view page (node 103:4593), see CATEGORIES below. Each card's
gallery sits between its own BEGIN/END markers, inside the card's hidden
"Show all components" region, so the script replaces exactly that span and
nothing else. A component with `"listed": false` stays in manifest.json but
gets no preview card (building blocks with no card of their own). The
Primitives cards and the Overview hero aren't categories: they're
hand-authored, not generated from meta.json.

Usage: python scripts/build_manifest.py
Fails loudly (nonzero exit, one line per problem) if any meta.json is
missing, malformed, or fails schema validation -- it does not silently
skip a broken component and build around it, since a manifest missing an
entry with no explanation would be worse than a build that stops.
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parent.parent
COMPONENTS_DIR = ROOT / "components"
SCHEMA_PATH = ROOT / "schemas" / "meta.schema.json"
MANIFEST_PATH = COMPONENTS_DIR / "manifest.json"

PAGE_PATH = ROOT / "index.html"

CATEGORIES = (
    "buttons", "tags", "inputs", "toasters", "tables", "navigation",
    "sidebar", "cards-layouts", "controls", "popups",
)


def gallery_start(category):
    return (
        f"<!-- BEGIN GENERATED COMPONENT GALLERY: {category} "
        "(scripts/build_manifest.py -- do not edit by hand, edit a "
        "component's meta.json and rerun the script instead) -->"
    )


def gallery_end(category):
    return f"<!-- END GENERATED COMPONENT GALLERY: {category} -->"


def collect_components(schema):
    """Return (metas, errors). metas is only populated when errors is empty --
    callers should treat any errors as fatal before using metas."""
    validator = jsonschema.Draft7Validator(schema)
    metas = []
    errors = []
    for meta_path in sorted(COMPONENTS_DIR.glob("*/meta.json")):
        component_dir = meta_path.parent.name
        if component_dir == "TEMPLATE":
            continue
        rel = meta_path.relative_to(ROOT)
        try:
            meta = json.loads(meta_path.read_text())
        except json.JSONDecodeError as e:
            errors.append(f"{rel}: invalid JSON -- {e}")
            continue
        schema_errors = sorted(validator.iter_errors(meta), key=lambda e: list(e.path))
        if schema_errors:
            for err in schema_errors:
                loc = "/".join(str(p) for p in err.path) or "<root>"
                errors.append(f"{rel}: {loc}: {err.message}")
            continue
        if meta.get("name") != component_dir:
            errors.append(
                f'{rel}: "name" field is "{meta.get("name")}", '
                f'but the folder is "{component_dir}" -- meta.schema.json '
                f'requires them to match'
            )
            continue
        metas.append(meta)
    return metas, errors


def write_manifest(metas):
    metas_sorted = sorted(metas, key=lambda m: m["name"])
    MANIFEST_PATH.write_text(json.dumps(metas_sorted, indent=2) + "\n")
    return metas_sorted


def render_card(meta):
    name = meta["name"]
    # name/status/description are filled in at runtime by site.js, which
    # fetches this same component's meta.json client-side (see
    # renderComponentCards() in site.js) -- this generator only needs to
    # emit the skeleton every card already shares, keyed off data-component.
    # data-layout="wide" (meta.json's optional `layout`) spans the card across
    # both grid columns -- see schemas/meta.schema.json for when it applies.
    layout = f' data-layout="{meta["layout"]}"' if meta.get("layout") else ""
    return f'''        <article class="component-card" data-component="{name}"{layout}>
          <div class="card-header">
            <span class="name"></span>
            <a href="components/{name}/index.html" target="_blank">open standalone ↗</a>
          </div>
          <div class="card-body">
            <iframe src="components/{name}/index.html" title="{name} component preview" scrolling="no"></iframe>
          </div>
          <p class="card-desc"></p>
        </article>'''


def render_gallery(category, metas_sorted):
    cards = "\n\n".join(render_card(m) for m in metas_sorted)
    return f'''{gallery_start(category)}
    <div class="component-grid">
{cards}
    </div>
    {gallery_end(category)}'''


def replace_gallery(text, category, gallery_html):
    start, end = gallery_start(category), gallery_end(category)
    if text.count(start) != 1 or text.count(end) != 1:
        print(
            f"error: {PAGE_PATH.relative_to(ROOT)} must contain exactly one "
            f"pair of {category!r} generated-gallery markers -- add\n"
            f"  {start}\n  {end}\n"
            f"once by hand inside that category's <section>, then rerun.",
            file=sys.stderr,
        )
        sys.exit(1)
    before, _, rest = text.partition(start)
    _, _, after = rest.partition(end)
    return before + gallery_html + after


def main():
    schema = json.loads(SCHEMA_PATH.read_text())
    metas, errors = collect_components(schema)
    if errors:
        print(
            "build_manifest: invalid component metadata, fix before continuing:",
            file=sys.stderr,
        )
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    metas_sorted = write_manifest(metas)
    print(f"wrote {MANIFEST_PATH.relative_to(ROOT)} ({len(metas_sorted)} components)")

    by_category = defaultdict(list)
    for meta in metas_sorted:
        if meta.get("listed", True):
            by_category[meta["category"]].append(meta)

    unknown = sorted({m["category"] for m in metas_sorted} - set(CATEGORIES))
    if unknown:
        print(
            f"build_manifest: no index.html section for category {unknown} -- "
            f"add it to CATEGORIES and to the page",
            file=sys.stderr,
        )
        sys.exit(1)

    text = PAGE_PATH.read_text()
    for category in CATEGORIES:
        text = replace_gallery(
            text, category, render_gallery(category, by_category.get(category, []))
        )
        print(f"regenerated {category} gallery ({len(by_category.get(category, []))} components)")
    PAGE_PATH.write_text(text)
    print(f"wrote {PAGE_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
