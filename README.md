![preview-image](github-prevew.png)
# dis-system

A design system of vanilla HTML/CSS/JS components driven by design tokens.
No framework and no runtime build step: a page links one token stylesheet
plus each component's own CSS and JS. Every visual value is a `--ds-*`
custom property, so light and dark themes switch with one attribute.

The design source is the Figma file D_SYSTEM. Older components were built
in Penpot, and some were first taken from a consuming application's
Figma file; each component's `meta.json` `source` says which
(`figma:<file>#<node>`, `penpot:<id>` or `none`). Design principle:
rational brutalism -- a visual choice needs a functional reason, and each
component's `meta.json` states that reason (see `PRINCIPLES.md`).

## Contents

```
tokens/        design tokens (Tokens Studio format) and the generated output.css
icons/         the icon set, drawn in currentColor
components/    one folder per component, plus manifest.json (all metadata)
components/TEMPLATE/  the scaffold every new component is copied from
schemas/       meta.schema.json, the contract every meta.json follows
scripts/       compose.py (build-time includes), build_manifest.py
tests/         pytest suite for the build scripts and repo-wide rules
index.html     presentation of the system (site.css/js, nav.js, showcase/)
PRINCIPLES.md  the design principle every component is judged against
WORKFLOW.md    step-by-step process for building or editing a component
CLAUDE.md      conventions and hard rules, for agents and humans
```

Each component folder holds:

| file | what it is |
|---|---|
| `template.html` | the component's markup, a Jinja2 fragment parameterized by its props |
| `style.css` | its styles; reads only `var(--ds-*)` tokens |
| `component.js` | its behavior, plain DOM, no dependencies |
| `meta.json` | props, variants, source, the functional rationale, a11y notes |
| `demo.html` / `index.html` | its demo (source / composed page) |

`components/manifest.json` collects every `meta.json` in one file for tools
and agents.

## Using a component

1. Link the tokens once per page, then the component's stylesheet and script:

   ```html
   <link rel="stylesheet" href="dis-system/tokens/output.css">
   <link rel="stylesheet" href="dis-system/components/text-button/style.css">
   ...
   <script src="dis-system/components/text-button/component.js"></script>
   ```

2. Put its markup in the page. Either write the markup its
   `template.html` produces, or include the template and compose the page
   at build time (step 3). The props a template accepts are listed in its
   `meta.json`.

3. Compose pages that `{% include %}` templates:

   ```sh
   pip install -r requirements.txt
   python dis-system/scripts/compose.py --pages my-pages --output public
   ```

   ```html
   {% with priority='primary', status='active', underline='dotted', label='Save' %}
     {% include "components/text-button/template.html" %}
   {% endwith %}
   ```

A component takes only data from the host page (text, URLs, state) through
its props -- never a style value. Custom properties prefixed `--_` are
private to the system.

## Themes

Light is the default. Dark is `data-theme="dark"` on the `<html>` element.
Components never hard-code a theme value, so nothing else changes.

## Icons

`icons/<name>.svg`, 24px, names as in Figma (`save`, `checkbox`,
`arrow-down`, ...). Components load them through a `data-icon="<name>"`
element and inline the SVG, so it takes the element's `color`; a second
paint (a box interior, a check mark) comes from `--_icon-fill` /
`--_icon-mark`. Single-color icons also work as a CSS `mask`.

## Tokens

`tokens/*.json` are the source; `tokens/output.css` is generated from them:

```sh
python tokens/build.py
```

Names follow `--ds-<category>-<path>`, e.g. `--ds-color-accent-1`,
`--ds-font-body-text-size`, `--ds-spacing-5`, `--ds-shadow-tief-1`.

## Presentation

`index.html` shows every token and component card. It loads files with
`fetch`, so serve the folder over HTTP rather than opening it from disk:

```sh
python -m http.server 8000
```

After editing a component's `template.html`, `demo.html` or `meta.json`,
regenerate the composed pages and the manifest:

```sh
python scripts/compose.py
python scripts/compose.py --pages showcase-src --output showcase
python scripts/build_manifest.py
python -m pytest tests
```

## License

MIT, see `LICENSE`.
