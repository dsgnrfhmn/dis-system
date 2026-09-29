# WORKFLOW.md

The repeatable process for building or editing a component in this design
system. This is the detailed version of `CLAUDE.md`'s "Building a component"
summary — read that first for the short form and the hard rules; this file
is the step-by-step so nobody (human or agent) has to re-derive it per
component, including real gotchas found building `table-cell` and
`table-row`.

Do not skip steps or reorder them. If a step turns up something ambiguous,
stop there and flag it (see CLAUDE.md's "If something is ambiguous") rather
than pushing ahead and hoping a later step resolves it.

---

## 0. Before you start

Read, in order:
- `PRINCIPLES.md` — the acceptance criterion (rational brutalism), not
  background reading.
- `tokens/$metadata.json` and `tokens/$themes.json` — token set order and
  theme structure.
- `components/TEMPLATE/` — the file structure every component copies.
- `schemas/meta.schema.json` — the exact required `meta.json` fields.

## 1. Copy the template

```
cp -r components/TEMPLATE components/<name>
```

Adapt every file inside — class names, content, `<!-- comments -->` — don't
leave TEMPLATE's text-button-specific markup or its `[TEMPLATE NOTE --
delete this paragraph...]` placeholder behind. TEMPLATE is a reduced
`text-button` (priority x status x underline); `components/text-button/`
is the full version it was cut from. `<name>` must satisfy
`meta.schema.json`'s `name` pattern (`^[a-z][a-z0-9-]*$`) and must equal the
folder name — `scripts/build_manifest.py` rejects a mismatch.

## 2. Pull the real element from the design source via MCP

Record where the design came from in `meta.json`'s `source`
(`figma:<fileKey>#<nodeId>[,<nodeId>...]`, `penpot:<shapeId>`, or `none`
with the reason in `rationale`; `schemas/meta.schema.json` enforces the
format).

The current source is the Figma D_SYSTEM file (its key is the `<fileKey>`
in existing components' `source`): use the Figma MCP's `get_design_context` / `get_variable_defs` on the node,
and map every value to a token (add the token if it's missing, don't
hard-code it). For components that were built from Penpot, the Penpot
route below still applies:

Use `mcp__penpot__execute_code` (after reading the Penpot high-level
overview once) to find the actual shape(s),
not a guess from looking at an export image:

- `penpotUtils.findShapes(predicate)` to locate the component's instance(s)
  by name. Expect noise: the same name can match hundreds of shapes across
  every page (instances, nested icon boards, text children) — narrow with
  `.component()?.variantProps` to isolate one instance per variant
  combination, and store the filtered result in `storage` so you don't
  re-run the broad search.
- **A single execute_code call has an output-size limit.** Don't return
  full `shapeStructure()` trees for many shapes at once — you'll hit
  "result exceeds maximum allowed tokens" and get nothing back. Query
  narrow (one shape, a few fields) and iterate; use `storage` to carry
  intermediate shape references between calls instead of re-searching.
- **DOM/children order is not visual order for `row-reverse` layouts.**
  Penpot's own row-like components can author children in `row-reverse`
  with content-first DOM order — the *last* child renders leftmost. Don't
  assume `shape.children[0]` is the first visible cell; sort by each
  child's own `parentX` and verify empirically (this exact assumption was
  wrong once for `table-row` and had to be corrected after checking real
  x-positions).
- For every visual property you're about to hardcode in CSS, check whether
  Penpot's own `shape.tokens` binds it to a token (Token-bound) or whether
  it's just a raw pixel value that happens to match a token (pixel-matched)
  — both are usable, but say which in the component's comments/rationale;
  don't blur the two.
- Export a shape to PNG (`mcp__penpot__export_shape`) whenever a visual
  claim needs eyeballing, not just measuring — e.g. confirming what an icon
  actually looks like before deciding whether it reads as its intended
  affordance. Don't assume a component name (e.g. "Drag") implies a
  particular appearance without looking.
- If Penpot's own State/Comment/etc. axis has a placeholder value across
  most instances (seen twice: `"Value 1"`, `"Value 3"`) rather than a real
  distinct state, don't model it as a prop — say so in `rationale` instead
  of inventing behavior for it.

## 3. Check every token against `tokens/output.css`

- Re-run `python tokens/build.py` first if any `tokens/*.json` file changed
  since it was last generated.
- Every value your CSS uses must resolve to a `var(--ds-*)` already defined
  in `tokens/output.css` — colors, spacing, typography, shadows, radius,
  border-width. No inline magic numbers, no ad-hoc hex codes, no local
  `:root` overrides.
- If a value Penpot's instance actually uses isn't in the generated tokens
  (a real gap, not just a lookup failure), stop and flag it in `meta.json`'s
  rationale — don't invent a local value to paper over it. `tokens/build.py`'s
  own module docstring documents the known gaps already found this way
  (e.g. `accent-1`/`accent-2`/`system.*` having no `disabled` entry).

## 4. Build the component

- `template.html`, `demo.html`, `style.css`, `component.js`, `meta.json` —
  same five files TEMPLATE has, same relative link depth
  (`../../tokens/output.css`). `template.html` is the raw, includable
  markup fragment only (Jinja2, no `<link>`/`<script>`, parameterized by
  prop/variant); `demo.html` is hand-authored and composes it (plus, for
  real composition, other components' `template.html`) into what
  `scripts/compose.py` compiles to `index.html` — never hand-edit
  `index.html` itself.
- No inline styles, no inline event handlers — behavior lives in
  `component.js`.
- If the component composes another real component (a button inside a
  table cell, a dropdown inside a cell, etc.), `{% include %}` that
  component's own `template.html` from this one's `template.html`
  (declaring it in `meta.json`'s `uses`), and link its `style.css`/
  `component.js` — don't re-implement a near-duplicate of an existing
  component's look. If the pairing is demo-only illustration rather than
  real composition (this component's own `template.html` never includes
  the other), show it in `demo.html` instead and link that component's
  assets by hand there — see `components/dropdown-menu/demo.html` for a
  real example of that distinction.
- Run `python scripts/compose.py` once `template.html`/`demo.html` are
  written, to generate `index.html`.
- Every component must render correctly in both themes purely by consuming
  `var(--ds-*)` — never hardcode a theme-specific value.
- Only add behavior beyond what a static design tool can model (hover
  states, a working dropdown open/close, a checkbox actually toggling,
  drag-to-reorder) when it closes a *functional* gap, and only when asked
  or clearly implied — not as decoration. Document why in `rationale`: this
  is a distinct category from "invented" and CLAUDE.md treats it
  differently, but it still needs to be named as an addition, not silently
  presented as sourced from Penpot.

## 5. Fill `meta.json` completely

- Every field `schemas/meta.schema.json` requires, no more (`additionalProperties: false` — a field not in the schema fails validation, don't add ad hoc ones).
- `rationale` is the acceptance criterion from `PRINCIPLES.md` made
  concrete: for every non-obvious visual or behavioral choice, say *why it
  looks/behaves this way, functionally* — traced to an actual
  `shape.tokens` / text-child token read via `execute_code`, not "looks
  clean." If you deviated from Penpot's source on explicit request, say
  so and say what changed. If you found something ambiguous or
  inconsistent in Penpot's own data (an undocumented variant, a duplicated
  icon with no explained purpose, a typo in source content), name it
  rather than quietly resolving or dropping it.
- `a11y_notes` — only for non-trivial keyboard/ARIA/focus behavior; note
  real gaps (e.g. a decorative SVG standing in for a native control, or a
  mouse-only interaction with no keyboard equivalent) rather than omitting
  them.

## 6. Validate against the schema

```
python3 -c "
import json, jsonschema
schema = json.load(open('schemas/meta.schema.json'))
meta = json.load(open('components/<name>/meta.json'))
jsonschema.validate(meta, schema)
print('valid')
"
```
`scripts/build_manifest.py` (step 8) re-validates this too and fails loudly
on any problem, but check it locally first rather than discovering a typo
only at manifest-build time.

## 7. Verify rendering in both themes

Serve the repo (`python3 -m http.server` from the repo root) and open the
generated `components/<name>/index.html` directly (run `python
scripts/compose.py` first if you've touched `template.html`/`demo.html`
since the last build) — don't rely on reading the CSS and
assuming it's correct. Toggle `data-theme="light"` / `data-theme="dark"` on
`<html>` (or use the component's own theme toggle if it has one) and
confirm both render correctly. **Do not mark `status: "stable"` until this
actually passes** — a component that only renders correctly in one theme is
not done, per CLAUDE.md's hard rules. If no browser is available in your
environment, say so explicitly rather than claiming this step passed.

## 8. Regenerate the manifest and confirm the gallery

```
python scripts/build_manifest.py
```

This scans every `components/*/meta.json` (skipping `TEMPLATE/`), validates
each against the schema (nonzero exit, one line per problem, on any
failure), writes `components/manifest.json`, and regenerates each card's
`<!-- BEGIN/END GENERATED COMPONENT GALLERY: <category> -->` block in the
root `index.html` -- the gallery behind that card's "Show all components"
toggle. `category` is one of the component cards of the Figma D_SYSTEM
web-view page (buttons, tags, inputs, toasters, tables, navigation,
sidebar, cards-layouts, controls, popups); `"listed": false` keeps a
building block in manifest.json but out of the site. Run it after adding,
renaming, or recategorizing any component, then confirm the component's
preview appears under the right card's toggle and its standalone
link/iframe work.

## 9. Update the card's presentation, if the component is on it

Each component card on the site shows a presentation page built from real
component instances: `showcase-src/<card>.html` (Jinja, `{% include %}`s of
the components' `template.html`, laid out as that card's Figma block),
composed into `showcase/<card>.html` and embedded in the card as an
iframe:

```
python scripts/compose.py --pages showcase-src --output showcase
```

Run it after changing any `template.html` a presentation page includes
(the composed pages are static output -- never hand-edit `showcase/`).
Pages link their own component CSS/JS (this mode does no asset
injection). The Buttons card is the exception: its lists are built by
`site-showcase.js`, which mirrors text-button's template -- change both
together.
