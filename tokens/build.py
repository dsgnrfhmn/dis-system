#!/usr/bin/env python3
"""
Resolves tokens/*.json (DTCG-style, Tokens Studio file format; edited in this repo, which is
the source of truth) into
tokens/output.css: a single stylesheet defining --ds-* custom properties
for both themes.

Source of truth, per tokens/$metadata.json's tokenSetOrder:
  Base-Primitives.json  - raw color palette (blue.700 -> #0000AD, ...)
  Base-Type.json        - raw font primitives + typography composites
  Base-Shapes.json      - borderWidth / radius / spacing / shadow composites
  Color-Base-Light.json - semantic color tokens for :root
  Color-Base-Dark.json  - semantic color tokens for [data-theme="dark"]

Styles (see STYLES): a style other than Base overrides only the slots it
changes, switched with data-style="<name>" on the same element as
data-theme. For each style <S> there are three files:
  Style-<S>.json        - mode-independent overrides: raw base.* palette
                          primitives (--ds-color-base-*) and shadow composites
                          (--ds-shadow-*), emitted under [data-style="<s>"]
  Color-<S>-Light.json  - semantic color overrides for light, emitted under
                          [data-style="<s>"]:not([data-theme="dark"])
  Color-<S>-Dark.json   - semantic color overrides for dark, emitted under
                          [data-style="<s>"][data-theme="dark"]
Every override must name a slot Base already defines for that mode (fails
loudly otherwise): a style recolors the system, it never adds slots. A slot a
style leaves out keeps its Base value -- Mono relies on that to keep the
colors that carry meaning (system.*, row-status.*, tag.*, ...).

Naming: --ds-<category>-<dotted-path-with-hyphens>, camelCase token names
converted to kebab-case, a trailing ".default" path segment dropped.

Known gaps in the source token set (do not silently paper over):
  - accent-1, accent-2 and system.* have no "disabled" entry. Disabled
    button state therefore falls back to object-white/object-dark's
    disabled color + text.inactive (the only disabled tokens that exist),
    losing variant color on disable. See CLAUDE.md.
  - Base-Shapes.json has a second, unused top-level {none,low,mid,high}
    "borderRadius" set alongside the real `radius.*` group. Ambiguous
    duplicate from the source export - intentionally NOT emitted here.
    Flagged for the maintainer to resolve here.
"""
import json
import re
from pathlib import Path

TOKENS_DIR = Path(__file__).parent
OUT_PATH = TOKENS_DIR / "output.css"


def load(name):
    with open(TOKENS_DIR / f"{name}.json") as f:
        return json.load(f)


def flatten(d, prefix=()):
    """dotted-path -> {'$value':..., '$type':...} for every leaf token."""
    out = {}
    for k, v in d.items():
        if isinstance(v, dict) and "$value" in v:
            out[".".join(prefix + (k,))] = v
        elif isinstance(v, dict):
            out.update(flatten(v, prefix + (k,)))
    return out


def camel_to_kebab(s):
    s = re.sub(r"(?<!^)(?=[A-Z])", "-", s)
    s = re.sub(r"(?<=[a-zA-Z])(?=[0-9])", "-", s)
    return s.lower()


def resolve_ref(value, registry):
    """Resolve a '{dotted.path}' reference (possibly chained) to a raw value."""
    seen = 0
    while isinstance(value, str) and value.startswith("{") and value.endswith("}"):
        path = value[1:-1]
        if path not in registry:
            raise ValueError(f"Unresolved token reference: {{{path}}}")
        value = registry[path]["$value"]
        seen += 1
        if seen > 10:
            raise ValueError(f"Reference chain too deep resolving {{{path}}}")
    return value


def css_var_name(dotted_path):
    path = dotted_path
    if path.endswith(".default"):
        path = path[: -len(".default")]
    parts = [camel_to_kebab(p) for p in path.split(".")]
    return "-".join(parts)


def resolve_color_set(color_file, registry_base):
    """Flatten a Color-Base-*.json file, resolve every $value against
    registry_base (primitives). Returns dotted-path -> hex string, plus
    a registry usable for further lookups (e.g. by shadow composites)."""
    flat = flatten(color_file)
    resolved = {}
    for path, tok in flat.items():
        resolved[path] = resolve_ref(tok["$value"], registry_base)
    return flat, resolved


def build_typography_vars(type_file, primitives_registry):
    typo = flatten(type_file.get("typography", {}))
    lines = []
    for name, tok in typo.items():
        var_base = f"--ds-font-{camel_to_kebab(name)}"
        v = tok["$value"]

        families = v.get("fontFamilies", [])
        resolved_families = [resolve_ref(f, primitives_registry) for f in families]
        flat_families = []
        for fam in resolved_families:
            flat_families.extend(fam if isinstance(fam, list) else [fam])
        family_css = ", ".join(
            f'"{f}"' if " " in f else f for f in flat_families
        )
        lines.append(f"  {var_base}-family: {family_css};")

        size = resolve_ref(v["fontSizes"], primitives_registry)
        lines.append(f"  {var_base}-size: {size}px;")

        # Some fontWeights primitives (e.g. font.weight.regular-italic) encode
        # style in the same string: "400 italic". font-weight only accepts a
        # number/keyword, so "400 italic" is invalid CSS and silently drops
        # the whole declaration. Split it into a numeric weight plus a
        # separate -style var instead of emitting the compound verbatim.
        weight_raw = str(resolve_ref(v["fontWeights"], primitives_registry))
        weight_parts = weight_raw.split(None, 1)
        weight = weight_parts[0]
        style = weight_parts[1] if len(weight_parts) > 1 else "normal"
        lines.append(f"  {var_base}-weight: {weight};")
        lines.append(f"  {var_base}-style: {style};")

        line_height = resolve_ref(v["lineHeights"], primitives_registry)
        lines.append(f"  {var_base}-line-height: {line_height};")

        letter_spacing = v.get("letterSpacing", "0")
        lines.append(f"  {var_base}-letter-spacing: {letter_spacing};")

        if "textDecoration" in v:
            lines.append(f"  {var_base}-text-decoration: {v['textDecoration']};")
    return lines


def build_shape_vars(shapes_file):
    """borderWidth / radius / spacing -> px values. Shadow handled separately
    (theme-dependent). The stray top-level {none,low,mid,high} borderRadius
    set is intentionally skipped - see module docstring."""
    lines = []
    for group in ("borderWidth", "radius", "spacing"):
        flat = flatten(shapes_file.get(group, {}))
        for path, tok in flat.items():
            var_name = css_var_name(f"{group}.{path}") if "." not in path else None
            # borderWidth/radius/spacing keys are single-level (e.g. "thin", "3")
            var_name = f"--ds-{camel_to_kebab(group)}-{camel_to_kebab(path)}"
            lines.append(f"  {var_name}: {tok['$value']}px;")
    return lines


def build_shadow_vars(shapes_file, theme_registry):
    """Shadow composites may reference theme colors as well as primitives,
    so they are resolved per-theme."""
    flat = flatten(shapes_file.get("shadow", {}))
    lines = []
    for name, tok in flat.items():
        layers = tok["$value"]
        css_layers = []
        for layer in layers:
            color = resolve_ref(layer["color"], theme_registry)
            inset = " inset" if layer.get("inset") else ""
            css_layers.append(
                f"{layer['offsetX']}px {layer['offsetY']}px "
                f"{layer['blur']}px {layer['spread']}px {color}{inset}"
            )
        var_name = f"--ds-shadow-{camel_to_kebab(name)}"
        lines.append(f"  {var_name}: {', '.join(css_layers)};")
    return lines


def build_color_vars(resolved):
    lines = []
    for path, value in resolved.items():
        lines.append(f"  --ds-color-{css_var_name(path)}: {value};")
    return lines


# Figma palette primitives (Base-Primitives.json groups) emitted as
# --ds-color-<group>-<key> in the plain :root block, so both themes see the
# same raw colors (they are theme-independent primitives, not semantics).
PALETTE_GROUPS = ("base", "accent", "signal")


def build_palette_vars(primitives):
    lines = []
    for group in PALETTE_GROUPS:
        for path, tok in flatten({group: primitives[group]}).items():
            lines.append(f"  --ds-color-{css_var_name(path)}: {tok['$value']};")
    return lines


def split_light_only(light_resolved, dark_resolved):
    """Slots defined for light but not for dark. They must NOT go in the bare
    :root block: [data-theme="dark"] has no override for them, so dark would
    silently inherit the light value. They are emitted under
    :root:not([data-theme="dark"]) instead, leaving dark on each component's
    own var() fallback (no invented dark values)."""
    shared = {p: v for p, v in light_resolved.items() if p in dark_resolved}
    only = {p: v for p, v in light_resolved.items() if p not in dark_resolved}
    return shared, only


# Styles layered over Base, in output order. Mono: black and white only
# (garv, 2026-10-27); its source is this repo, not Figma -- see CLAUDE.md.
STYLES = ("Mono",)


def check_overrides(style, mode, override_resolved, base_resolved):
    orphans = sorted(set(override_resolved) - set(base_resolved))
    if orphans:
        raise ValueError(
            f"Color-{style}-{mode}.json overrides slots Base does not define "
            f"for {mode.lower()}: {', '.join(orphans)}"
        )


def build_style_blocks(style, primitives_registry, light_resolved, dark_resolved):
    """CSS blocks for one style layered over Base. Placed after every Base
    block, so equal-specificity selectors win by source order."""
    style_file = load(f"Style-{style}")
    _, mono_light = resolve_color_set(load(f"Color-{style}-Light"), primitives_registry)
    _, mono_dark = resolve_color_set(load(f"Color-{style}-Dark"), primitives_registry)
    check_overrides(style, "Light", mono_light, light_resolved)
    check_overrides(style, "Dark", mono_dark, dark_resolved)

    sel = f'[data-style="{style.lower()}"]'
    common = [f"  /* palette overrides (Style-{style}: base) */"]
    for path, tok in flatten({"base": style_file.get("base", {})}).items():
        common.append(f"  --ds-color-{css_var_name(path)}: {resolve_ref(tok['$value'], primitives_registry)};")
    common.append("")
    common.append(f"  /* shadow overrides (Style-{style}: shadow) */")
    for name, tok in flatten(style_file.get("shadow", {})).items():
        common.append(f"  --ds-shadow-{camel_to_kebab(name)}: {tok['$value']};")

    out = []
    out.append(f"/* {style} style: mode-independent overrides */")
    out.append(f"{sel} {{")
    out.extend(common)
    out.append("}")
    out.append("")
    out.append(f'{sel}:not([data-theme="dark"]) {{')
    out.append(f"  /* colors (Color-{style}-Light) */")
    out.extend(build_color_vars(mono_light))
    out.append("}")
    out.append("")
    out.append(f'{sel}[data-theme="dark"] {{')
    out.append(f"  /* colors (Color-{style}-Dark) */")
    out.extend(build_color_vars(mono_dark))
    out.append("}")
    out.append("")
    return out


def main():
    primitives = load("Base-Primitives")
    type_file = load("Base-Type")
    shapes_file = load("Base-Shapes")
    light_file = load("Color-Base-Light")
    dark_file = load("Color-Base-Dark")

    primitives_flat = flatten(primitives)
    type_primitives_flat = flatten({k: v for k, v in type_file.items() if k != "typography"})
    primitives_registry = {**primitives_flat, **type_primitives_flat}

    light_flat, light_resolved = resolve_color_set(light_file, primitives_registry)
    dark_flat, dark_resolved = resolve_color_set(dark_file, primitives_registry)

    # shadow composites in Base-Shapes.json may reference theme color
    # tokens as well as raw primitives (tief-1/tief-2 currently use only
    # base.* primitives), so each theme resolves them against its own set.
    light_shadow_registry = {**primitives_registry, **light_flat}
    dark_shadow_registry = {**primitives_registry, **dark_flat}

    root_lines = []
    light_shared, light_only = split_light_only(light_resolved, dark_resolved)
    root_lines.append("  /* colors (Color-Base-Light, slots that also exist in dark) */")
    root_lines.extend(build_color_vars(light_shared))
    root_lines.append("")
    root_lines.append("  /* palette (Base-Primitives: base / accent / signal) */")
    root_lines.extend(build_palette_vars(primitives))
    root_lines.append("")
    root_lines.append("  /* typography (Base-Type) */")
    root_lines.extend(build_typography_vars(type_file, primitives_registry))
    root_lines.append("")
    root_lines.append("  /* shape (Base-Shapes: borderWidth/radius/spacing) */")
    root_lines.extend(build_shape_vars(shapes_file))
    root_lines.append("")
    root_lines.append("  /* shadow (Base-Shapes, resolved against light colors) */")
    root_lines.extend(build_shadow_vars(shapes_file, light_shadow_registry))

    dark_lines = []
    dark_lines.append("  /* colors (Color-Base-Dark) */")
    dark_lines.extend(build_color_vars(dark_resolved))
    dark_lines.append("")
    dark_lines.append("  /* shadow (Base-Shapes, resolved against dark colors) */")
    dark_lines.extend(build_shadow_vars(shapes_file, dark_shadow_registry))

    out = []
    out.append("/* GENERATED FILE - do not edit by hand.")
    out.append("   Run `python tokens/build.py` after changing any tokens/*.json. */")
    out.append("")
    out.append(":root {")
    out.extend(root_lines)
    out.append("}")
    out.append("")
    out.append('[data-theme="dark"] {')
    out.extend(dark_lines)
    out.append("}")
    out.append("")
    out.append('/* light-only slots: no dark value exists, so dark must not inherit them */')
    out.append(':root:not([data-theme="dark"]) {')
    out.append("  /* colors (Color-Base-Light, slots with no dark counterpart) */")
    out.extend(build_color_vars(light_only))
    out.append("}")
    out.append("")

    for style in STYLES:
        out.extend(build_style_blocks(style, primitives_registry, light_resolved, dark_resolved))

    OUT_PATH.write_text("\n".join(out))
    print(f"Wrote {OUT_PATH} ({len(root_lines) + len(dark_lines) + len(light_only)} lines of declarations)")


if __name__ == "__main__":
    main()
