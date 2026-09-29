"""Tests for scripts/build_manifest.py.

Synthetic component trees under tmp_path (same approach as
test_compose.py), with the module's path globals pointed at them; the real
schemas/meta.schema.json is used so the tests track the actual contract.
"""

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build_manifest  # noqa: E402

SCHEMA = json.loads((ROOT / "schemas" / "meta.schema.json").read_text())


def meta_for(name, **overrides):
    meta = {
        "name": name,
        "description": "test component",
        "status": "draft",
        "category": "buttons",
        "variants": [],
        "props": [],
        "source": "none",
        "rationale": "test",
        "themes_supported": ["light", "dark"],
    }
    meta.update(overrides)
    return meta


def write_meta(components_dir, folder, meta):
    d = components_dir / folder
    d.mkdir(parents=True, exist_ok=True)
    (d / "meta.json").write_text(json.dumps(meta))


@pytest.fixture
def repo(tmp_path, monkeypatch):
    root = tmp_path / "repo"
    components = root / "components"
    components.mkdir(parents=True)
    monkeypatch.setattr(build_manifest, "ROOT", root)
    monkeypatch.setattr(build_manifest, "COMPONENTS_DIR", components)
    monkeypatch.setattr(build_manifest, "MANIFEST_PATH", components / "manifest.json")
    monkeypatch.setattr(build_manifest, "PAGE_PATH", root / "index.html")
    monkeypatch.setattr(build_manifest, "SCHEMA_PATH", ROOT / "schemas" / "meta.schema.json")
    return root


# ---- collect_components ------------------------------------------------------

def test_valid_components_are_collected(repo):
    write_meta(repo / "components", "alpha", meta_for("alpha"))
    metas, errors = build_manifest.collect_components(SCHEMA)
    assert errors == [] and [m["name"] for m in metas] == ["alpha"]


def test_template_folder_is_skipped(repo):
    write_meta(repo / "components", "TEMPLATE", meta_for("text-button"))
    metas, errors = build_manifest.collect_components(SCHEMA)
    assert metas == [] and errors == []


def test_missing_required_field_is_an_error(repo):
    meta = meta_for("alpha")
    del meta["rationale"]
    write_meta(repo / "components", "alpha", meta)
    _, errors = build_manifest.collect_components(SCHEMA)
    assert any("rationale" in e for e in errors)


def test_name_must_match_folder(repo):
    write_meta(repo / "components", "alpha", meta_for("beta"))
    _, errors = build_manifest.collect_components(SCHEMA)
    assert any("folder" in e for e in errors)


@pytest.mark.parametrize("source, ok", [
    ("figma:DSYSTEMFILEKEY#103:4732", True),
    ("figma:DSYSTEMFILEKEY#150:16233,150:16275", True),
    ("penpot:28cec651-3f14-8022-8008-8c9a0bb4dc55", True),
    ("none", True),
    ("28cec651-3f14-8022-8008-8c9a0bb4dc55", False),
    ("figma:abc", False),
    ("not-applicable-see-rationale", False),
])
def test_source_format(repo, source, ok):
    write_meta(repo / "components", "alpha", meta_for("alpha", source=source))
    _, errors = build_manifest.collect_components(SCHEMA)
    assert (errors == []) is ok


def test_unknown_category_is_rejected_by_the_schema(repo):
    write_meta(repo / "components", "alpha", meta_for("alpha", category="widgets"))
    _, errors = build_manifest.collect_components(SCHEMA)
    assert any("category" in e for e in errors)


# ---- page galleries ------------------------------------------------------------

def page_with_all_markers():
    parts = ["<html><body>"]
    for c in build_manifest.CATEGORIES:
        parts.append(f'<section id="{c}">hand-written {c}\n'
                     f"{build_manifest.gallery_start(c)}\nold\n{build_manifest.gallery_end(c)}\n</section>")
    parts.append("</body></html>")
    return "\n".join(parts)


def test_replace_gallery_only_touches_the_marked_region():
    text = f"before\n{build_manifest.gallery_start('tags')}\nold\n{build_manifest.gallery_end('tags')}\nafter"
    out = build_manifest.replace_gallery(text, "tags", "NEW")
    assert out == "before\nNEW\nafter"


def test_replace_gallery_fails_loudly_without_markers():
    with pytest.raises(SystemExit):
        build_manifest.replace_gallery("no markers here", "tags", "NEW")


def test_wide_layout_is_emitted_on_the_card():
    assert 'data-layout="wide"' in build_manifest.render_card(meta_for("a", layout="wide"))
    assert "data-layout" not in build_manifest.render_card(meta_for("a"))


def test_main_writes_manifest_and_galleries(repo):
    comps = repo / "components"
    write_meta(comps, "shown", meta_for("shown", category="tags"))
    write_meta(comps, "hidden", meta_for("hidden", category="tags", listed=False))
    (repo / "index.html").write_text(page_with_all_markers())

    build_manifest.main()

    manifest = json.loads((comps / "manifest.json").read_text())
    assert [m["name"] for m in manifest] == ["hidden", "shown"]  # unlisted still in the manifest
    page = (repo / "index.html").read_text()
    tags = page.split(build_manifest.gallery_start("tags"))[1].split(build_manifest.gallery_end("tags"))[0]
    assert 'data-component="shown"' in tags
    assert 'data-component="hidden"' not in page
    assert "hand-written tags" in page and "old" not in tags


def test_main_fails_on_invalid_metadata(repo):
    write_meta(repo / "components", "alpha", meta_for("beta"))
    (repo / "index.html").write_text(page_with_all_markers())
    with pytest.raises(SystemExit):
        build_manifest.main()
    assert not (repo / "components" / "manifest.json").exists()


# ---- the real repo -------------------------------------------------------------

def test_every_real_component_meta_is_valid():
    metas, errors = build_manifest.collect_components(SCHEMA)
    assert errors == [], errors
    assert metas
