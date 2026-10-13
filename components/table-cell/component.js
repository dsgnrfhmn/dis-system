/*
  table-cell

  Most Type variants are static content (text/icon/link) with no behavior of
  their own. The rest compose other components that own their own behavior
  already, nothing to add here for them:
  - action-button cells (1-action, 2-actions) compose .ds-text-button (see
    components/text-button/component.js). icon-cell (icon glyphs only, no
    buttons) doesn't need anything beyond the [data-icon] loader below.
  - data-type="dropdown" composes .ds-input-dropdown (see
    components/input-dropdown/component.js, linked in this component's
    index.html) -- it fires ds-input-dropdown-open, not a table-cell-
    specific event; listen for that.
  - data-type="input" composes plain .ds-input -- no behavior beyond
    native <input>.

  The one thing this file still owns:
  - [data-icon]: loads the real vector glyph from icons/<name>.svg (see
    icons/) and inlines it, replacing the empty placeholder mark. Inlined
    (not <img src>) specifically so the SVG's fill="currentColor" picks up
    this element's `color` (see style.css) and repaints correctly per theme
    -- an <img> can't do that. Requires being served over http(s); fetch()
    of a local icons/*.svg fails under a bare file:// open.
*/

// Wrapped in an IIFE so this file's top-level ICONS_BASE doesn't collide
// with the identically-named top-level const other component.js files
// declare -- classic (non-module) <script> tags share one global scope, so
// a consumer page loading more than one of these scripts together would
// otherwise hit "Identifier 'ICONS_BASE' has already been declared".
(function () {

/*
  Icon base path is resolved from this script's own URL
  (document.currentScript), not the hosting page's -- a plain relative
  fetch("../../icons/...") only works when the page itself sits exactly
  two directories below icons/ (true for every components/<name>/
  index.html in this repo, coincidentally, but not for an external
  consumer's own page, which can sit at any depth once this repo is
  vendored as a git submodule -- see scripts/compose.py's own --pages
  mode docstring). Every icon-loading component.js in this system shares
  this same fix, captured synchronously at script-load time since
  document.currentScript is only valid outside an await.
*/
const ICONS_BASE = new URL('../../icons/', document.currentScript.src);

document.querySelectorAll('.ds-table-cell__icon[data-icon]').forEach(async (el) => {
  try {
    const res = await fetch(new URL(`${el.dataset.icon}.svg`, ICONS_BASE));
    el.innerHTML = await res.text();
  } catch (err) {
    // icons/ unreachable (e.g. opened without a server) -- leave empty
  }
});

/*
  Saved/favourite toggle (explicit request, mirrors
  a consuming app's own row-favorite click -> is-active
  behavior): a real functional gap, not decoration, same category as
  table-row's checkbox-cell click-to-select -- Penpot's own icon-cell
  source has no click/saved-state concept at all. Scoped to
  data-icon="save" specifically, not every icon-cell icon, since
  archive/analyse icons in the same cell type are actions, not a
  persistent saved flag.

  data-sort-value on the closest .ds-table-cell (bugfix, found 2026-09-11
  via direct user report, "check the save sorting, it does not seem to
  do anything"): a page-level sort listener (the consuming app's [data-sort-
  group] handler, generalizing this repo's own site.js sort algorithm)
  reads each row's cell via `cellA.dataset.sortValue ?? cellA.textContent`
  -- an icon-only cell has neither set by anything, before this, so every
  row compared as an equal empty string against every other and sorting
  by Saved was silently a no-op, not a regression from any of this
  session's earlier CSS-only changes to this same column. Setting
  data-sort-value here (both at load, from whatever data-saved the
  markup was authored with, and again on every toggle so it never goes
  stale) is the missing half of the same "compose, don't own the host's
  data" contract table-header-cell's own sort button already documents:
  this component owns the boolean, so it -- not each consuming page's
  markup -- is responsible for exposing it in the one shape the generic
  sort listener already knows how to read.
*/
/*
  Shift+click range save (2026-09-18, same as row selection in
  table-row/component.js): a click on a row's Save icon makes that row the
  anchor; a Shift+click on another row's icon then sets every row between
  the anchor and it, both included, to the state the clicked icon is
  switching to. Same rules as selection:
  - the anchor is the last row whose Save icon was clicked in the same table
    (rows sharing a parent), tracked separately from the selection anchor;
  - rows in their current DOM order (what a column sort shows), skipping rows
    with the native `hidden` attribute (filtered out by a live search);
  - no anchor, an anchor that left this table or is hidden: a plain toggle;
  - the header's own "save all" icon has no row, so it never takes part;
  - one ds-table-cell-favourite-toggle per click, detail { saved, range }, so
    the header's all-saved state resolves once;
  - mousedown is cancelled while Shift is held, or the browser would also
    extend a text selection across the rows in between.
*/
const lastSavedRow = new WeakMap(); // table (rows' parent) -> last row whose Save icon was clicked

function setFavourite(icon, saved) {
  icon.setAttribute('data-saved', String(saved));
  const cell = icon.closest('.ds-table-cell');
  if (cell) cell.dataset.sortValue = String(saved);
}

// Tracks the anchor for every row-icon click; returns true when it applied a
// Shift range (so the caller must not toggle the clicked icon a second time).
function saveRange(icon, next, shift) {
  const row = icon.closest('.ds-table-row');
  if (!row) return false;
  const table = row.parentElement;
  const anchor = lastSavedRow.get(table);
  lastSavedRow.set(table, row);
  if (!shift || !anchor || anchor === row || anchor.parentElement !== table || anchor.hidden) return false;

  const rows = Array.from(table.children).filter(
    (el) => el.classList.contains('ds-table-row') && !el.hidden
  );
  const from = rows.indexOf(anchor);
  const to = rows.indexOf(row);
  if (from === -1 || to === -1) return false;
  rows.slice(Math.min(from, to), Math.max(from, to) + 1).forEach((r) => {
    const rowIcon = r.querySelector(
      ':scope > .ds-table-cell[data-type="icon-cell"] .ds-table-cell__icon[data-icon="save"]'
    );
    if (rowIcon) setFavourite(rowIcon, next);
  });
  return true;
}

document.querySelectorAll('.ds-table-cell[data-type="icon-cell"] .ds-table-cell__icon[data-icon="save"]').forEach((icon) => {
  const cell = icon.closest('.ds-table-cell');
  if (cell) {
    cell.dataset.sortValue = icon.getAttribute('data-saved') === 'true' ? 'true' : 'false';
  }

  icon.addEventListener('mousedown', (event) => {
    if (event.shiftKey) event.preventDefault();
  });

  icon.addEventListener('click', (event) => {
    const next = icon.getAttribute('data-saved') !== 'true';
    const range = saveRange(icon, next, event.shiftKey);
    if (!range) setFavourite(icon, next);
    // Bubbling notification so a group-level "save all" header control
    // (table-row/component.js's updateFavouriteAllState) can stay in sync
    // with a single row's toggle -- added 2026-09-08, explicit
    // request ("the checkbox logic should apply to it"), same category as
    // ds-table-row-select existing for row-selection checkboxes.
    icon.dispatchEvent(new CustomEvent('ds-table-cell-favourite-toggle', {
      bubbles: true,
      detail: { saved: next, range },
    }));
  });
});

/*
  Editable text cell (A9, explicit request, the consumer spec):
  the edit trigger is a button elsewhere in the same row (see
  meta.json's extra_attrs note), carrying data-edit-trigger. Finding the
  target cell via .closest('.ds-table-row') keeps this generic -- no ids
  needed, since a row composing this feature has exactly one editable
  cell to find. Blur commits (reads .value, never .innerHTML); Escape
  reverts to the value the cell had when edit mode was entered, not
  necessarily its original render value, so repeated edit/cancel cycles
  each revert to the last real commit, not silently back to render time.
*/
document.querySelectorAll('[data-edit-trigger]').forEach((trigger) => {
  trigger.addEventListener('click', () => {
    const row = trigger.closest('.ds-table-row');
    if (!row) return;
    const cell = row.querySelector('.ds-table-cell[data-editable]');
    if (!cell) return;
    const text = cell.querySelector('.ds-table-cell__text');
    const input = cell.querySelector('.ds-table-cell__edit-input');
    if (!text || !input) return;

    input.value = text.textContent;
    text.hidden = true;
    input.hidden = false;
    input.focus();
    input.select();

    function commit() {
      text.textContent = input.value;
      cleanup();
    }
    function revert() {
      cleanup();
    }
    function cleanup() {
      input.removeEventListener('blur', commit);
      input.removeEventListener('keydown', onKeydown);
      input.hidden = true;
      text.hidden = false;
    }
    function onKeydown(event) {
      if (event.key === 'Escape') revert();
    }
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', onKeydown);
  });
});

// Collapse an excerpt that has no room (explicit request 2026-10-11). A text cell is an
// excerpt (.ds-table-cell__clip, ellipsized) followed by a text button, usually "view". The
// excerpt is shown only when its column leaves room for MIN_EXCERPT (explicit request
// 2026-10-12: as much as "Dear Artist, This October, ARRIVAL Gallery will bring artists");
// with less room the excerpt is hidden (style.css, [data-collapsed]) and the button is
// renamed after the field, taken from its data-collapse-label ("Summary", "Full
// Description"). Opt-in per button; a cell without the attribute is untouched. Re-measured
// whenever the cell's width changes (column resize, window resize) and for cells added later.
//
// The decision is the column's, never the text's: it compares the room the excerpt is given
// (the cell's text box minus the button, the same in every row because the button label is
// the same) with the width of MIN_EXCERPT in the excerpt's own font. Every row of a column
// therefore collapses, or none does.
const MIN_EXCERPT = 'Dear Artist, This October, ARRIVAL Gallery will bring artists';
const COLLAPSIBLE = '.ds-table-cell__text:has(> .ds-table-cell__clip) > .ds-text-button[data-collapse-label]';
const measureContext = document.createElement('canvas').getContext('2d');

function excerptFits(wrap, clip, button) {
  const style = getComputedStyle(clip);
  measureContext.font = style.font || `${style.fontSize} ${style.fontFamily}`;
  return wrap.clientWidth - button.offsetWidth >= measureContext.measureText(MIN_EXCERPT).width;
}

// The node holding a text button's label: text-button wraps the bare text in
// .ds-text-button__text (the dotted underline lives on that span), so the label is set
// there. Replacing the button's own textContent would drop the wrapper and the underline.
function labelNode(button) {
  return button.querySelector(':scope > .ds-text-button__text, :scope > .ds-text-button__label') || button;
}

// A column's buttons are decided in one pass: every button is put back to its shown state
// (writes), then every one is measured (reads), then the ones without room are collapsed
// (writes). Deciding them one at a time forced a layout per button, which on a few hundred
// rows left the "view" labels on screen for seconds before they turned into the field name.
function updateCollapse(buttons) {
  const items = [];
  buttons.forEach((button) => {
    const wrap = button.parentElement;
    const clip = wrap.querySelector(':scope > .ds-table-cell__clip');
    if (!clip) return;
    const label = labelNode(button);
    const original = button.dataset.collapseOriginal || label.textContent;
    button.dataset.collapseOriginal = original;
    items.push({ button, wrap, clip, label, original });
  });
  // Measure the excerpt as it would be shown: visible, with the original label.
  items.forEach((item) => {
    item.wrap.removeAttribute('data-collapsed');
    item.label.textContent = item.original;
  });
  items.forEach((item) => { item.fits = excerptFits(item.wrap, item.clip, item.button); });
  items.forEach((item) => {
    // Measured: style.css shows the cell from here on, in its final state.
    item.wrap.setAttribute('data-collapse-ready', '');
    if (item.fits) return;
    item.wrap.setAttribute('data-collapsed', '');
    item.label.textContent = item.button.dataset.collapseLabel;
  });
}

const collapseObserver = new ResizeObserver((entries) => {
  const buttons = [];
  entries.forEach((entry) => {
    entry.target.querySelectorAll(':scope > .ds-text-button[data-collapse-label]').forEach((b) => buttons.push(b));
  });
  updateCollapse(buttons);
});
const observed = new WeakSet();

function watchCollapsible(root) {
  root.querySelectorAll(COLLAPSIBLE).forEach((button) => {
    const wrap = button.parentElement;
    if (observed.has(wrap)) return;
    observed.add(wrap);
    collapseObserver.observe(wrap);
  });
}

watchCollapsible(document);
new MutationObserver((mutations) => {
  mutations.forEach((m) => m.addedNodes.forEach((node) => {
    if (node.nodeType === 1) watchCollapsible(node);
  }));
}).observe(document.body, { childList: true, subtree: true });

})();
