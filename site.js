/*
  Script for index.html's long read: the Primitives section's live token
  swatches, the component-card grids scripts/build_manifest.py generates
  into each category section, and the section sidebar's current-section
  marker (initSectionSidebar). Every function below no-ops if its target
  elements aren't on the page.

  Theme state itself (storage, the nav-bar toggle) lives in nav.js, shared
  by every root page's nav-bar; this file has no theme opinion of its own,
  it only syncs embedded component iframes to whatever nav.js announces via
  the ds-theme-change event (and data-style via ds-style-change), plus
  applies the page's current theme and style to any iframe as it loads.
*/

// Colors card, after the Figma D_SYSTEM web-view (node 103:4608): three
// columns of raw palette primitives (theme-independent), one strip per
// color, labeled with the token name. `on` is the label color the strip
// needs to stay legible: a fixed primitive too, since the fill never
// changes with the theme.
const COLOR_COLUMNS = [
  ['Accent', [
    ['accent-primary', 'light'],
    ['accent-secondary', 'light'],
    ['accent-tertiary', 'light'],
    ['accent-primary-light', 'dark'],
    ['accent-secondary-light', 'dark'],
    ['accent-tertiary-light', 'dark'],
  ]],
  ['Neutral', [
    ['base-1000', 'light'],
    ['base-900', 'light'],
    ['base-800', 'light'],
    ['base-750', 'light'],
    ['base-600', 'light'],
    ['base-250', 'dark'],
    ['base-150', 'dark'],
    ['base-warm-100', 'dark'],
    ['base-100', 'dark'],
    ['base-0', 'dark'],
  ]],
  ['System', [
    ['signal-success-strong', 'light'],
    ['signal-success', 'light'],
    ['signal-success-light', 'dark'],
    ['signal-warning-strong', 'light'],
    ['signal-warning', 'dark'],
    ['signal-warning-light', 'dark'],
    ['signal-error-strong', 'light'],
    ['signal-error', 'dark'],
    ['signal-error-light', 'dark'],
  ]],
];

// Typography card, after the Figma type table (node 103:4670): one row per
// style -- the sample set in its token, then family / weight / size read
// back from the resolved --ds-font-<token>-* vars. `decoration` is the
// link underline convention (CLAUDE.md: solid leaves the page, dotted
// stays on it); `upper` is the caption treatment.
const TYPE_ROWS = [
  ['Heading 1', 'heading-1'],
  ['Heading 2', 'heading-2'],
  ['Heading 3', 'heading-3'],
  ['Heading 4', 'heading-4'],
  ['Heading 5', 'heading-5'],
  ['Body text regular', 'body-text'],
  ['Body text medium', 'body-text-medium'],
  ['Body text regular italic', 'body-text-italic'],
  ['External link text', 'text-link', { decoration: 'solid' }],
  ['Internal link text', 'text-link', { decoration: 'dotted' }],
  ['Captions text', 'data', { upper: true }],
];

const WEIGHT_NAMES = { 400: 'regular', 500: 'medium', 600: 'semibold', 700: 'bold' };

// Depth steps, after the Figma D_SYSTEM shadow block (node 124:6952):
// flat, tief-1, tief-2. `null` = no shadow (the flat surface).
const SHADOW_SWATCHES = [
  ['none', null],
  ['tief-1', '--ds-shadow-tief-1'],
  ['tief-2', '--ds-shadow-tief-2'],
];

const SPACING_SWATCHES = [
  ['spacing-0', '--ds-spacing-0'],
  ['spacing-1', '--ds-spacing-1'],
  ['spacing-2', '--ds-spacing-2'],
  ['spacing-3', '--ds-spacing-3'],
  ['spacing-4', '--ds-spacing-4'],
  ['spacing-5', '--ds-spacing-5'],
  ['spacing-6', '--ds-spacing-6'],
  ['spacing-7', '--ds-spacing-7'],
  ['spacing-8', '--ds-spacing-8'],
  ['spacing-9', '--ds-spacing-9'],
];

function renderColorSwatches() {
  const root = document.getElementById('color-swatches');
  if (!root) return;
  const styles = getComputedStyle(document.documentElement);
  for (const [group, colors] of COLOR_COLUMNS) {
    const column = document.createElement('div');
    column.className = 'color-column';
    column.innerHTML = `<p class="color-column__label">${group}</p><div class="color-column__strips"></div>`;
    const strips = column.querySelector('.color-column__strips');
    for (const [name, on] of colors) {
      const varName = `--ds-color-${name}`;
      const el = document.createElement('div');
      el.className = 'color-strip';
      el.dataset.on = on;
      el.style.backgroundColor = `var(${varName})`;
      el.title = `${varName}: ${styles.getPropertyValue(varName).trim()}`;
      el.textContent = name;
      strips.appendChild(el);
    }
    root.appendChild(column);
  }
}

function renderTypeScale() {
  const root = document.getElementById('type-scale');
  if (!root) return;
  const styles = getComputedStyle(document.documentElement);
  for (const [label, token, opts = {}] of TYPE_ROWS) {
    const read = (prop) => styles.getPropertyValue(`--ds-font-${token}-${prop}`).trim();
    const v = (prop) => `var(--ds-font-${token}-${prop})`;
    const family = read('family').split(',')[0].trim();
    const weight = WEIGHT_NAMES[read('weight')] || read('weight');
    const italic = read('style') === 'italic' ? ' italic' : '';
    const deco = opts.decoration === 'solid' ? ', underlined' : opts.decoration === 'dotted' ? ', underdotted' : '';
    const upper = opts.upper ? ', uppercase' : '';
    const el = document.createElement('div');
    el.className = 'type-row';
    el.setAttribute('role', 'row');
    if (opts.decoration) el.dataset.decoration = opts.decoration;
    if (opts.upper) el.dataset.upper = 'true';
    el.innerHTML = `
      <span class="type-row__sample" role="cell" style="font-family: ${v('family')}; font-size: ${v('size')}; font-weight: ${v('weight')}; line-height: ${v('line-height')}; letter-spacing: ${v('letter-spacing')}; font-style: ${v('style')};">${label}</span>
      <span class="type-row__meta" role="cell">${family}, ${weight}${italic}${deco}${upper}, ${read('size')} <code>${token}</code></span>
    `;
    root.appendChild(el);
  }
}

// Icons card, after the Figma D_SYSTEM icon set (node 103:4711): the
// web-view icons from icons/, in the Figma order, at their native 24px.
// Inlined (not <img>) so currentColor and the --_icon-fill paint come from
// the theme, exactly as in components; site.css colors each group. No
// visible labels (as in Figma); the name is the element's title.
const ICON_SET = [
  'checkbox', 'save', 'drag', 'arrow-down', 'arrow-left', 'arrow-right',
  'arrow-up', 'close', 'add', 'filter', 'counter', 'notification',
  'loading', 'radio', 'radio-selected', 'theme-dark', 'theme-mid',
  'theme-light',
];

function renderIconSet() {
  const root = document.getElementById('icon-set');
  if (!root) return;
  for (const name of ICON_SET) {
    const el = document.createElement('span');
    el.className = 'icon-set__icon';
    el.dataset.icon = name;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', name);
    el.title = `icons/${name}.svg`;
    root.appendChild(el);
    fetch(`icons/${name}.svg`)
      .then((res) => res.text())
      .then((svg) => { el.innerHTML = svg; })
      .catch(() => {});
  }
}

function renderShadowSwatches() {
  const root = document.getElementById('shadow-swatches');
  if (!root) return;
  for (const [label, varName] of SHADOW_SWATCHES) {
    const el = document.createElement('div');
    el.className = 'shadow-sample';
    el.innerHTML = `
      <div class="box" style="box-shadow: ${varName ? `var(${varName})` : 'none'};"></div>
      <div class="label">${label}</div>
    `;
    root.appendChild(el);
  }
}

function renderSpacingSwatches() {
  const root = document.getElementById('spacing-swatches');
  if (!root) return;
  const styles = getComputedStyle(document.documentElement);
  for (const [label, varName] of SPACING_SWATCHES) {
    const value = styles.getPropertyValue(varName).trim();
    const el = document.createElement('div');
    el.className = 'spacing-sample';
    el.innerHTML = `
      <div class="bar" style="width: var(${varName});"></div>
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    `;
    root.appendChild(el);
  }
}

async function renderComponentCards() {
  const cards = document.querySelectorAll('.component-card[data-component]');
  for (const card of cards) {
    const name = card.dataset.component;
    try {
      const res = await fetch(`components/${name}/meta.json`);
      const meta = await res.json();
      card.querySelector('.name').textContent = `${meta.name} — ${meta.status}`;
      card.querySelector('.card-desc').textContent = meta.description;
    } catch (err) {
      card.querySelector('.name').textContent = name;
      card.querySelector('.card-desc').textContent = 'meta.json failed to load.';
    }
  }
}

function resizeIframe(iframe) {
  try {
    const doc = iframe.contentDocument;
    if (!doc || !doc.documentElement || !doc.body) return;

    // scrollHeight/offsetHeight alone can under-report when the tallest
    // content is an absolutely-positioned overflow (an open
    // dropdown-menu) rather than normal-flow content -- some engines
    // don't fold that into body/documentElement's own scroll size. Take
    // the max across both elements' metrics, then also check each open
    // menu's actual bottom edge directly as a floor.
    let height = Math.max(
      doc.documentElement.scrollHeight,
      doc.documentElement.offsetHeight,
      doc.body.scrollHeight,
      doc.body.offsetHeight
    );
    doc.querySelectorAll('.ds-dropdown-menu:not([hidden])').forEach((menu) => {
      const scrollY = doc.defaultView ? doc.defaultView.scrollY : 0;
      height = Math.max(height, menu.getBoundingClientRect().bottom + scrollY);
    });
    // An open .ds-popup-overlay is position:fixed, so it's sized to the
    // IFRAME'S OWN viewport (the iframe box itself), not to this
    // document's scroll height -- growing the iframe box is exactly what
    // reveals more of it, unlike a normal-flow element. Without this, an
    // open modal renders clipped to whatever height the closed state
    // (a few buttons) already measured. Floor is the composed .ds-popup
    // panel's own natural height (it sizes to its content regardless of
    // the overlay's current box) plus the overlay's own padding, so the
    // whole panel fits without being cropped.
    doc.querySelectorAll('.ds-popup-overlay:not([hidden])').forEach((overlay) => {
      const panel = overlay.querySelector(':scope > .ds-popup');
      if (!panel) return;
      const overlayStyle = doc.defaultView.getComputedStyle(overlay);
      const verticalPadding =
        (parseFloat(overlayStyle.paddingTop) || 0) + (parseFloat(overlayStyle.paddingBottom) || 0);
      height = Math.max(height, panel.offsetHeight + verticalPadding);
    });
    iframe.style.height = `${height}px`;
  } catch (err) {
    // cross-origin — ignore
  }
}

function initComponentGrid() {
  // Gallery previews and the cards' presentation pages (showcase/*.html).
  const iframes = document.querySelectorAll('.component-card iframe, .site-card__frame');
  if (!iframes.length) return;

  const currentTheme = () => document.documentElement.dataset.theme || 'light';
  // data-style mirrors the page's: absent (Base) here means absent there.
  const syncStyle = (iframe) => {
    const style = document.documentElement.dataset.style;
    const target = iframe.contentDocument.documentElement;
    if (style) target.dataset.style = style;
    else delete target.dataset.style;
  };

  iframes.forEach((iframe) => {
    iframe.addEventListener('load', () => {
      try {
        iframe.contentDocument.documentElement.dataset.theme = currentTheme();
        syncStyle(iframe);
        // Re-measure whenever a .ds-dropdown-menu's or .ds-popup-overlay's
        // `hidden` attribute flips (opening/closing it) -- that's the
        // actual event that changes the required iframe size, so watch it
        // directly instead of guessing from generic clicks. A fixed
        // iframe height would otherwise clip the open menu/modal.
        // table-preview switching to a type with fewer rows: the measure
        // below only ever reads a height at least the iframe's current
        // one (the document fills its viewport), so collapse it first and
        // measure the content alone.
        iframe.contentDocument.addEventListener('ds-table-preview-type-change', () => {
          iframe.style.height = '0px';
          resizeIframe(iframe);
        });
        const menus = iframe.contentDocument.querySelectorAll('.ds-dropdown-menu');
        const overlays = iframe.contentDocument.querySelectorAll('.ds-popup-overlay');
        if (menus.length || overlays.length) {
          const observer = new MutationObserver(() => resizeIframe(iframe));
          menus.forEach((menu) => {
            observer.observe(menu, { attributes: true, attributeFilter: ['hidden'] });
          });
          overlays.forEach((overlay) => {
            observer.observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
          });
        }
      } catch (err) {
        // ignore
      }
      resizeIframe(iframe);
    });
  });

  // A gallery inside a card's hidden "Show all components" region loads at
  // zero height (a hidden iframe has no layout); re-measure when it opens.
  document.addEventListener('ds-showcase-toggle', (e) => {
    if (!e.detail.open) return;
    e.target.querySelectorAll('.component-card iframe').forEach(resizeIframe);
  });

  document.addEventListener('ds-style-change', () => {
    iframes.forEach((iframe) => {
      try {
        if (iframe.contentDocument) syncStyle(iframe);
      } catch (err) {
        // cross-origin or not yet loaded -- onload handler above covers it
      }
    });
  });

  document.addEventListener('ds-theme-change', (e) => {
    iframes.forEach((iframe) => {
      try {
        if (iframe.contentDocument) {
          iframe.contentDocument.documentElement.dataset.theme = e.detail.theme;
          resizeIframe(iframe);
        }
      } catch (err) {
        // cross-origin or not yet loaded — ignore, onload handler above covers it
      }
    });
  });
}

/*
  index.html's section sidebar (components/sidebar-list, type="set" rows
  with href="#<section>"): marks the row of the section currently at the
  top of <main> -- data-active="true" + aria-current, the same two
  attributes sidebar-item's own active row uses -- so the sidebar says
  where you are in the long read, the role aria-current="page" on nav-bar's
  links did when every category was its own page. The current section is
  the last one whose top has scrolled past a quarter of <main>'s height
  (so a section counts once its heading is comfortably in view, not only
  when it touches the very top); at the bottom of the page the last
  section wins even if it is too short to reach that line. A section can
  point at another row via data-spy-for="<row id>".
  Clicking a row needs no code: it is a plain #anchor link, and <main>'s
  scroll-behavior does the scrolling.
*/
function initSectionSidebar() {
  const sidebar = document.querySelector('.site-sidebar');
  const main = document.querySelector('.site-shell > main');
  if (!sidebar || !main) return;

  const rows = new Map();
  sidebar.querySelectorAll('.ds-sidebar-item a[href^="#"]').forEach((link) => {
    rows.set(link.getAttribute('href').slice(1), link);
  });
  const sections = Array.from(main.querySelectorAll(':scope > section[id]'));

  let current = null;
  function setCurrent(id) {
    if (id === current || !rows.has(id)) return;
    current = id;
    rows.forEach((link, rowId) => {
      const item = link.closest('.ds-sidebar-item');
      if (rowId === id) {
        item.dataset.active = 'true';
        link.setAttribute('aria-current', 'true');
      } else {
        delete item.dataset.active;
        link.removeAttribute('aria-current');
      }
    });
  }

  function update() {
    const line = main.getBoundingClientRect().top + main.clientHeight / 4;
    let id = sections.length ? sections[0].id : null;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) id = section.id;
    }
    if (main.scrollTop + main.clientHeight >= main.scrollHeight - 1 && sections.length) {
      id = sections[sections.length - 1].id;
    }
    const section = id && document.getElementById(id);
    setCurrent(section && section.dataset.spyFor ? section.dataset.spyFor : id);
  }

  let pending = false;
  main.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      update();
    });
  });
  update();
}

renderColorSwatches();
renderTypeScale();
renderIconSet();
renderShadowSwatches();
renderSpacingSwatches();
renderComponentCards();
initComponentGrid();
initSectionSidebar();
