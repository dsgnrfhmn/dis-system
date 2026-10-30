"""Tests for tokens/build.py, plus the repo-wide token and icon rules it
exists to enforce.

Unit tests cover the resolver on small synthetic inputs. The repo tests run
against the real tokens/, components/ and icons/ so a stale output.css, an
undefined --ds-* reference or a broken icon file fails here instead of in a
browser.
"""

import importlib.util
import re
import xml.dom.minidom
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent

_spec = importlib.util.spec_from_file_location("token_build", ROOT / "tokens" / "build.py")
build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build)


def tok(value, type_="color"):
    return {"$value": value, "$type": type_}


# ---- resolver --------------------------------------------------------------

def test_resolve_ref_follows_a_chain():
    registry = {"a": tok("{b}"), "b": tok("{c}"), "c": tok("#123456")}
    assert build.resolve_ref("{a}", registry) == "#123456"


def test_resolve_ref_passes_raw_values_through():
    assert build.resolve_ref("#abcdef", {}) == "#abcdef"
    assert build.resolve_ref(16, {}) == 16


def test_resolve_ref_fails_on_unknown_reference():
    with pytest.raises(ValueError, match="Unresolved"):
        build.resolve_ref("{missing.path}", {})


def test_resolve_ref_fails_on_a_reference_loop():
    registry = {"a": tok("{b}"), "b": tok("{a}")}
    with pytest.raises(ValueError, match="too deep"):
        build.resolve_ref("{a}", registry)


def test_flatten_collects_leaf_tokens_by_dotted_path():
    tree = {"accent-1": {"default": tok("#1"), "hover": tok("#2")}, "x": tok("#3")}
    assert set(build.flatten(tree)) == {"accent-1.default", "accent-1.hover", "x"}


@pytest.mark.parametrize("path, expected", [
    ("accent-1.default", "accent-1"),
    ("accent-1.hover", "accent-1-hover"),
    ("text.inverced", "text-inverced"),
    ("bodyTextMedium", "body-text-medium"),
    ("heading1", "heading-1"),
])
def test_css_var_name(path, expected):
    assert build.css_var_name(path) == expected


def test_typography_splits_a_compound_weight_into_weight_and_style():
    type_file = {"typography": {"bodyTextItalic": tok({
        "fontFamilies": "{font.family}",
        "fontSizes": "{font.size}",
        "fontWeights": "{font.weight}",
        "lineHeights": "{font.lh}",
    }, "typography")}}
    registry = {
        "font.family": tok("Inter"), "font.size": tok("16"),
        "font.weight": tok("400 italic"), "font.lh": tok("1.2"),
    }
    lines = build.build_typography_vars(type_file, registry)
    assert "  --ds-font-body-text-italic-weight: 400;" in lines
    assert "  --ds-font-body-text-italic-style: italic;" in lines
    assert "  --ds-font-body-text-italic-size: 16px;" in lines


def test_light_only_slots_are_split_out():
    shared, only = build.split_light_only({"a": "#1", "b": "#2"}, {"a": "#9"})
    assert shared == {"a": "#1"} and only == {"b": "#2"}


def test_style_override_of_a_slot_base_lacks_fails():
    with pytest.raises(ValueError, match="does not define"):
        build.check_overrides("Mono", "Dark", {"bg.row-current": "#000000"}, {"bg.surface": "#1A1918"})


# ---- the real repo -----------------------------------------------------------

def test_output_css_is_up_to_date(tmp_path, monkeypatch):
    out = tmp_path / "output.css"
    monkeypatch.setattr(build, "OUT_PATH", out)
    build.main()
    assert out.read_text() == (ROOT / "tokens" / "output.css").read_text(), (
        "tokens/output.css is stale -- run `python tokens/build.py`"
    )


def _strip_css_comments(text):
    return re.sub(r"/\*.*?\*/", "", text, flags=re.S)


def test_every_ds_variable_a_stylesheet_reads_is_a_token():
    """--ds-* is tokens only (CLAUDE.md): nothing may read a --ds-* name
    output.css doesn't define. Component-private properties use --_."""
    defined = set(re.findall(r"(--ds-[a-z0-9-]+):", (ROOT / "tokens" / "output.css").read_text()))
    sheets = sorted((ROOT / "components").glob("*/style.css")) + [ROOT / "site.css"]
    missing = {}
    for sheet in sheets:
        used = set(re.findall(r"var\((--ds-[a-z0-9-]+)", _strip_css_comments(sheet.read_text())))
        if used - defined:
            missing[str(sheet.relative_to(ROOT))] = sorted(used - defined)
    assert not missing, f"undefined --ds-* references: {missing}"


ICONS = sorted((ROOT / "icons").glob("*.svg"))


@pytest.mark.parametrize("icon", ICONS, ids=lambda p: p.name)
def test_icon_is_well_formed_and_has_no_hardcoded_color(icon):
    """Icons are also loaded as plain images and CSS masks, where a malformed
    file (e.g. '--' inside an XML comment) silently renders nothing. Colors
    come from currentColor and the component's --_icon-* properties."""
    xml.dom.minidom.parse(str(icon))
    assert not re.search(r"#[0-9a-fA-F]{3,6}\b", icon.read_text()), "hardcoded color in icon"


def test_every_static_data_icon_name_exists():
    names = {p.stem for p in ICONS}
    files = [p for p in (ROOT / "components").glob("*/*.html") if p.name != "index.html"]
    files += [ROOT / "site.js", ROOT / "site-showcase.js", ROOT / "nav.js"]
    missing = {}
    for f in files:
        for name in re.findall(r'data-icon="([a-z0-9-]+)"', f.read_text()):
            if name not in names:
                missing.setdefault(str(f.relative_to(ROOT)), set()).add(name)
    assert not missing, f"data-icon names with no icons/<name>.svg: {missing}"


# ---- Mono style --------------------------------------------------------------

def _mono_blocks():
    css = _strip_css_comments((ROOT / "tokens" / "output.css").read_text())
    blocks = {}
    for sel, body in re.findall(r"(\[data-style=\"mono\"\][^{]*)\{([^}]*)\}", css):
        blocks[sel.strip()] = dict(re.findall(r"(--ds-[a-z0-9-]+):\s*([^;]+);", body))
    return blocks


def test_mono_has_a_block_per_mode():
    assert set(_mono_blocks()) == {
        '[data-style="mono"]',
        '[data-style="mono"]:not([data-theme="dark"])',
        '[data-style="mono"][data-theme="dark"]',
    }


def test_mono_paints_only_black_and_white():
    """Mono is black and white, no greys (the maintainer, 2026-10-27). Its overrides are
    black, white, transparent (shadow colors) or none (shadows); every other
    color in Mono is a Base slot it deliberately leaves alone."""
    allowed = {"#000000", "#FFFFFF", "transparent", "none"}
    for sel, decls in _mono_blocks().items():
        bad = {k: v for k, v in decls.items() if v.strip() not in allowed}
        assert not bad, f"{sel} sets non-mono values: {bad}"

