# CLAUDE.md

Instructions for agents (and humans) working on this design system. Code
comments and `meta.json` files cite sections of this file by name, e.g.
"per CLAUDE.md's Interaction conventions".

## Context
A design system of vanilla HTML/CSS/JS components, rendered live in the
browser and machine-readable through `meta.json`. The design source is the
Figma file D_SYSTEM; some components were first taken from a consuming
application's Figma file, and older ones were built in Penpot. Every
component records its origin in `meta.json`'s `source`
(`figma:<file>#<node>`, `penpot:<id>` or `none`). The Figma file keys are
placeholders for now: `DSYSTEMFILEKEY` (D_SYSTEM), `APPFILEKEY` (the
consuming application's file) and `MAKEFILEKEY` (the Figma Make site
layout); node ids are real.
Audience: designers, developers and other agents. Machine-readability is as
important as visual output.

## Before creating or editing a component
1. Read `PRINCIPLES.md`. It is the acceptance criterion, not background
   reading. Rational brutalism: strip emotional or decorative styling that
   doesn't serve function or the user's goal. If a visual choice has no
   functional reason, don't make it.
2. Read `tokens/$metadata.json` and `tokens/$themes.json` for token set
   order and theme structure. Use only values defined in `tokens/*.json`.
   Primitives (`Base-Primitives.json` colors, and the raw `font.*` /
   `borderWidth` / `radius` / `spacing` entries in `Base-Type.json` /
   `Base-Shapes.json`) are raw values; semantic tokens
   (`Color-Base-Light.json`, `Color-Base-Dark.json`, the `typography.*`
   composites in `Base-Type.json`) reference them and are what components
   consume. No inline magic numbers, no ad-hoc hex codes. If a value is
   missing, stop and flag it -- don't invent one locally. Only one style
   is defined (Base).
3. Read `components/TEMPLATE/` for file structure. Copy it, don't reinvent
   structure per component.
4. Read `schemas/meta.schema.json` for the exact fields each `meta.json`
   requires. Don't add or omit fields freely.

## Building a component
Follow `WORKFLOW.md` step by step. In short:
- Pull the element from the design source and check every token used
  against `tokens/*.json` (resolved values in `tokens/output.css`).
- Create `components/<name>/{template.html,demo.html,style.css,component.js,meta.json}`
  from `TEMPLATE/`.
  - `template.html`: the component's includable markup fragment (Jinja2,
    parameterized by props). No `<link>`/`<script>` tags, no page
    structure.
  - `demo.html`: hand-authored; composes `template.html` (and, for real
    composition, other components' `template.html`, declared in `uses`)
    into the component's demo page.
  - `index.html`: **generated** by `scripts/compose.py` -- never edit it
    by hand.
- Fill `meta.json` fully:
  - `rationale`: why it looks the way it does, functionally.
  - `category`: which card of the root `index.html` lists its preview
    (buttons, tags, inputs, toasters, tables, navigation, sidebar,
    cards-layouts, controls, popups).
  - `listed` (optional): `false` for a building block with no card of its
    own -- it stays in `manifest.json` but gets no preview.
  - `layout` (optional): `"wide"` when the demo can't be read at half the
    gallery's width -- check by rendering it, not by guessing.
  - `uses`: components this one's `template.html` (not `demo.html`)
    includes; empty if none.
- Run the build (see Commands) and confirm the component appears under its
  card's "Show all components" in the root `index.html`, unless it is
  `listed: false`.

## Tokens
`tokens/*.json` are the source of truth; components never copy resolved
values. They use the Tokens Studio file format but are edited here --
design tools are not kept in sync and are never exported back over these
files. `tokens/build.py` writes `tokens/output.css` with resolved custom
properties for both themes.

- Naming: `--ds-<category>-<dotted-path-with-hyphens>`, camelCase names
  converted to kebab-case, a trailing `.default` dropped. Examples:
  - Color: `--ds-color-accent-1`, `--ds-color-accent-1-hover`,
    `--ds-color-object-white-passive`, `--ds-color-system-error`,
    `--ds-color-bg-surface`
  - Typography (one set per `typography.*` composite):
    `--ds-font-button-primary-family`, `-size`, `-weight`, `-line-height`,
    `-letter-spacing`
  - Shape: `--ds-border-width-default`, `--ds-radius-sm`, `--ds-spacing-5`
  - Shadow: `--ds-shadow-tief-1`, `--ds-shadow-tief-2` (both reference
    fixed primitives, so both themes get the same bevel)
- **Known source-data gaps** (don't paper over them silently; see
  `tokens/build.py`'s docstring):
  - `accent-1`, `accent-2` and `system.*` have no `disabled` entry. A
    disabled button uses `object-white`'s disabled color +
    `--ds-color-text-inactive` for every variant.
  - `Base-Shapes.json` has an unused top-level `{none, low, mid, high}`
    `borderRadius` set next to the real `radius.*` group. Treat it as
    orphaned until the maintainer says otherwise.
  - `radius.full` resolves to `0` -- real design data, not a pill shape.
    Don't "fix" it locally.
- Re-run `python tokens/build.py` whenever a token file changes.
- Token and CSS-variable names are kebab-case
  (`--ds-color-row-status-for-review-bg`). Data values that come from a
  host's own data keep that data's spelling (a row status `for_review`).
- `--ds-*` is tokens only: every `--ds-*` a component reads is defined in
  `output.css`. A host passes only data (text, URLs, state) through the
  props declared in `meta.json` / `template.html`, never a style value, and
  no component reads a custom property a host sets. A property private to
  the system's CSS/JS is prefixed `--_` (e.g. `--_toast-fill`,
  `--_resize-size`), so an audit can tell it apart from an undefined token.
- Components never declare their own `:root` or `[data-theme="dark"]`
  values -- they only consume `var(--ds-*)`.

## Commands
- `pip install -r requirements.txt`
- Rebuild tokens: `python tokens/build.py`
- Compose component demo pages: `python scripts/compose.py` -- resolves
  every `demo.html`'s includes into `index.html`, after checking each
  `meta.json`'s `uses` against the real includes (fails on a mismatch or a
  cycle). Run after editing any `template.html`, `demo.html` or `uses`.
- Compose the site's card presentations:
  `python scripts/compose.py --pages showcase-src --output showcase`.
  Never hand-edit `showcase/`.
- Regenerate the manifest: `python scripts/build_manifest.py` -- validates
  every `meta.json` against the schema (fails loudly), writes
  `components/manifest.json`, and regenerates each card's gallery in the
  root `index.html` between its
  `<!-- BEGIN/END GENERATED COMPONENT GALLERY: <category> -->` markers.
  Everything else in `index.html` is hand-authored.
- Consumer pages: `python scripts/compose.py --pages <dir> --output <dir>`
  composes a host project's own pages against these templates.
- Tests: `python -m pytest tests` -- covers compose.py, build_manifest.py,
  tokens/build.py, and repo-wide rules (output.css up to date, every
  `var(--ds-*)` a stylesheet reads is a defined token, every icon is
  well-formed with no hardcoded color, every `data-icon` name exists).
  Run it before committing.
- Local preview: `python -m http.server 8000` in the repo root (pages load
  files with `fetch`, so they need HTTP, not `file://`).

## Templates and escaping
`compose.py` renders with autoescape on: every prop is text. The one
exception is `extra_attrs`, raw attribute markup written by the page
author and marked `| safe` in the templates -- never pass end-user data
through it. URL props (`href`, `src`) go through the `safe_url` filter,
which replaces non-http(s)/mailto/tel schemes with `#`.

## Icons
- `icons/` holds the D_SYSTEM icon set, named as in Figma (`save`,
  `arrow-down`, ...), plus a separate file only for a state whose *shape*
  differs (`checkbox-selected`, `checkbox-semi-select`, `radio-selected`).
  A state that only changes color (hover, saved) is CSS.
- Every file draws in `currentColor`. A second paint (a box interior, a
  check mark) comes from `--_icon-fill` / `--_icon-mark`, set by the
  rendering component from tokens. Components inline icons through
  `[data-icon]` (fetch + innerHTML) so both apply; single-color icons may
  also be used as a CSS `mask` painted with a token.
- No hex colors inside an SVG, and no `--` inside its XML comments (that
  makes the file invalid as an image or mask). The tests check both.

## Theming
Every component must work in both Light and Dark, switching through the
custom properties mapped from `Color-Base-Light.json` /
`Color-Base-Dark.json` per `$themes.json`. Never hardcode a theme-specific
value in `style.css`. A component that renders correctly in only one theme
is not done.

## Interaction conventions
Cross-component conventions live here, not only in the `meta.json` of the
component that introduced them. Check this section before adding hover or
interaction styling, so a new control doesn't reinvent an affordance a
sibling already solved.

- **A permanent underline is the "this is clickable" affordance** for
  accent-colored interactive text. Hover and keyboard focus add `[ ]`
  brackets around the label; outlined buttons turn their border accent
  instead. Implemented through the required `underline` prop (`solid` |
  `dotted`) on `text-button`; disabled keeps the line in the disabled
  color, loading/confirmed carry none.
- **`solid` vs `dotted` signals what the click does, not taste**: `solid`
  (1px, `--ds-border-width-thin`) when the action navigates to a new
  page/URL; `dotted` (2px, so the dots stay visible) when it stays within
  the current page/view (opens a modal, loads more rows, expands a
  section). Choose per instance by behavior.
- A new clickable text/button-like component reuses this mechanism
  instead of inventing a new hover affordance -- unless there is a stated
  functional reason it doesn't apply (e.g. a control whose fill alone
  encodes state), recorded in its `meta.json` rationale.

## Hard rules
- No component ships without a `meta.json`.
- No token values hardcoded outside `tokens/*.json`. A value that repeats
  or belongs to a scale (spacing, gaps, offsets, type, color) is a token.
  One exception: a component's own fixed dimensions read off the design (a
  popup's width, an input's width, a 1-off hairline such as nav-bar's
  0.5px border) may be raw px, with a comment naming the source. The site's
  own chrome (`site.css`) follows the same rule.
- No decorative-only CSS (gradients, shadows, animation) without a
  functional rationale in `meta.json`.
- Don't build ahead of the design source -- if it isn't defined there, don't
  invent it here.
- `status: "stable"` requires verified rendering in both Light and Dark.

## If something is ambiguous
Stop and ask rather than guessing a default. Note the ambiguity in the
commit or PR description so it is visible, not silently resolved.
