/*
  table-row

  Selection is the one piece of row-level state, mirroring Penpot's
  Default/Selected State axis. It toggles only on a click inside the row's
  own checkbox-cell (data-type="checkbox-cell") -- not anywhere else in the
  row -- on explicit request. Other composed table-cell children (their own
  text-button/input/dropdown elements) keep their own independent behavior
  unaffected either way, since this listener is scoped to checkbox-cell to
  begin with rather than needing to exclude them.

  A row can carry more than one checkbox-cell-typed div: Penpot's own
  "Icon" Type (checkbox-cell's source) isn't checkbox-specific -- Collection
  and Snippet instances use the exact same layout for a reorder-
  handle icon (Penpot's own "Drag" asset, verified via MCP), and Check +
  Button carries two literal checkbox
  icons side by side (see table-row/meta.json's rationale for both). Only
  a checkbox-cell that actually holds the checkbox icon should be
  clickable-to-select, so this looks for [data-icon="checkbox"] inside the
  candidates rather than just grabbing the first checkbox-cell -- a plain
  :scope selector would have bound the click (and, in style.css, the
  pointer cursor) to whichever one happens to come first in the DOM,
  wrongly making a drag handle "select the row" in Collection/Snippet.

  The row's own checkbox-cell visually following data-selected -- swapping
  to its checked icon -- is handled entirely in CSS (see style.css's
  [data-checkbox-state] rules), keyed off the same data-selected attribute
  this file sets.
*/

/*
  Shift+click range selection (2026-09-18, "if I hold shift, everything
  between the two rows gets selected"), the same as a mail list: a plain
  click toggles that row and makes it the anchor; a Shift+click then sets
  every row between the anchor and the clicked row, both included, to the
  state the clicked row is switching to (so Shift+click on an unselected row
  selects the range, on a selected row deselects it). The anchor is the last
  row clicked in the same table -- rows sharing a parent element.

  - The range is taken over the rows' current DOM order, which is what the
    user sees after a column sort (sorting reorders the DOM).
  - Rows with the native `hidden` attribute (a live search filtering them out
    of view) are skipped: a range must not select what is not on screen.
  - One ds-table-row-select event per click, whether it changed one row or
    many, so bulk-action gating and the select-all state resolve once. Its
    detail is { selected, range } -- range is true for a Shift range.
  - No anchor yet, an anchor that has left this table (moved to another one)
    or is hidden: Shift+click just toggles the one row, like a plain click.
  - mousedown is cancelled while Shift is held: the browser would otherwise
    also extend a text selection across every row in between, highlighting
    the table. Pointer only -- the checkbox cell has no keyboard handler.
*/
const lastClickedRow = new WeakMap(); // table (rows' parent) -> last row clicked

document.querySelectorAll('.ds-table-row').forEach((row) => {
  const checkboxCell = Array.from(
    row.querySelectorAll(':scope > .ds-table-cell[data-type="checkbox-cell"]')
  ).find((cell) => cell.querySelector('[data-icon="checkbox"]'));
  if (!checkboxCell) return;

  checkboxCell.addEventListener('mousedown', (event) => {
    if (event.shiftKey) event.preventDefault();
  });

  checkboxCell.addEventListener('click', (event) => {
    const next = row.getAttribute('data-selected') !== 'true';
    const table = row.parentElement;
    const anchor = lastClickedRow.get(table);

    let range = false;
    if (event.shiftKey && anchor && anchor !== row && anchor.parentElement === table && !anchor.hidden) {
      const rows = Array.from(table.children).filter(
        (el) => el.classList.contains('ds-table-row') && !el.hidden
      );
      const from = rows.indexOf(anchor);
      const to = rows.indexOf(row);
      if (from !== -1 && to !== -1) {
        rows.slice(Math.min(from, to), Math.max(from, to) + 1)
          .forEach((r) => r.setAttribute('data-selected', String(next)));
        range = true;
      }
    }
    if (!range) row.setAttribute('data-selected', String(next));

    lastClickedRow.set(table, row);
    row.dispatchEvent(new CustomEvent('ds-table-row-select', {
      bubbles: true,
      detail: { selected: next, range },
    }));
  });
});

/*
  Select-all header checkbox (explicit request, mirrors the exact
  checked/indeterminate/toggle logic of a consuming app's own
  row-header select-all control -- see that site's updateSelectAllState
  and its selectAll*El "change" handlers). A [data-checkbox-group]
  container (e.g. table-row/demo.html's own multi-row block) may hold one
  header cell with data-checkbox-role="select-all" (table-cell/table-row's
  own checkbox_role prop) alongside several real .ds-table-row children:

  - checked when every row in the group is selected, indeterminate when
    some but not all are, unchecked when none are (or there are none) --
    table-cell/style.css's own [data-state] rules key its icon/color off
    this same attribute.
  - clicking the header cell selects every row when it isn't already
    fully checked, deselects every row when it is -- the same toggle a
    native <input type="checkbox"> gives for free via its own .checked
    flip before "change" fires, reproduced explicitly here since this
    control is a styled <span>, not a real checkbox input (same known
    a11y gap as the row checkbox itself -- see table-row/meta.json).
  - listens for ds-table-row-select (dispatched by the row click handler
    above, which already bubbles) rather than re-deriving row selection
    itself, so this stays in sync with row clicks with no duplicate logic.
*/
function updateSelectAllState(group) {
  const header = group.querySelector('.ds-table-cell[data-checkbox-role="select-all"]');
  if (!header) return;
  const rows = Array.from(group.querySelectorAll('.ds-table-row'));
  const total = rows.length;
  const selectedCount = rows.filter((row) => row.getAttribute('data-selected') === 'true').length;
  if (total > 0 && selectedCount === total) header.setAttribute('data-state', 'checked');
  else if (selectedCount > 0) header.setAttribute('data-state', 'indeterminate');
  else header.setAttribute('data-state', 'unchecked');
}

document.querySelectorAll('[data-checkbox-group]').forEach((group) => {
  updateSelectAllState(group);

  const header = group.querySelector('.ds-table-cell[data-checkbox-role="select-all"]');
  if (header) {
    header.addEventListener('click', () => {
      const selectAll = header.getAttribute('data-state') !== 'checked';
      group.querySelectorAll('.ds-table-row').forEach((row) => {
        row.setAttribute('data-selected', String(selectAll));
      });
      // Same event a single row click dispatches (bubbles), so listeners keyed
      // off row selection -- bulk-action gating on a consuming page, and this
      // group's own updateSelectAllState below -- also react to select-all.
      // Without it the rows changed silently and bulk buttons stayed disabled.
      group.dispatchEvent(new CustomEvent('ds-table-row-select', {
        bubbles: true,
        detail: { selected: selectAll, all: true },
      }));
    });
  }

  group.addEventListener('ds-table-row-select', () => updateSelectAllState(group));
});

/*
  Save-all header icon (explicit request, 2026-09-08, "Save icon should be
  in header-cell for all tables, where it is in the table itself (and the
  checkbox logic should apply to it)"): generalizes the exact same
  checked-when-all / click-toggles-all pattern as the select-all header
  checkbox above, applied to a table's favourite/save icon column instead
  of its row-selection column, so any table with a favourite-icon column
  gets this for free rather than every consuming page re-deriving it
  locally (this used to be a one-off IIFE hand-written on queue page
  alone, duplicated here for every table that has a save column instead).
  A [data-checkbox-group] container may additionally hold one header cell
  marked data-favourite-all (table-cell's icon-cell type, a single
  favourite icon -- see table-cell/meta.json) alongside rows that each
  carry a favourite icon-cell of their own (table-cell/component.js's
  click-to-toggle data-saved, which now also dispatches
  ds-table-cell-favourite-toggle so this file can hear it).

  - the header icon reads "all saved" (data-saved="true") only when every
    row's favourite icon is saved; any row unsaved brings it back to
    data-saved="false" -- the same all-or-nothing semantics
    updateSelectAllState gives real checkboxes, minus a 3rd/indeterminate
    icon state, which the favourite glyph has no visual asset for (unlike
    checkbox-cell's dedicated checkbox-semi-select.svg, only 2 favourite
    icon states exist: saved/unsaved).
  - clicking the header icon: table-cell/component.js's own generic
    favourite-click listener (loaded before this file, see
    <script src> order in every consumer page) already flips this header
    icon's own data-saved for us, since the header cell is itself a
    regular icon-cell as far as that listener is concerned -- this
    listener runs second and only adds the cascade, reading the header's
    now-toggled state and applying that same value to every row (not
    inverting it again).
  - stays in sync with row-level toggles via the bubbled
    ds-table-cell-favourite-toggle event rather than re-deriving state a
    different way.
*/
function updateFavouriteAllState(group) {
  const header = group.querySelector('.ds-table-cell[data-favourite-all] .ds-table-cell__icon[data-icon="save"]');
  if (!header) return;
  const icons = Array.from(group.querySelectorAll('.ds-table-row .ds-table-cell[data-type="icon-cell"] .ds-table-cell__icon[data-icon="save"]'));
  const total = icons.length;
  const savedCount = icons.filter((icon) => icon.getAttribute('data-saved') === 'true').length;
  header.setAttribute('data-saved', String(total > 0 && savedCount === total));
}

document.querySelectorAll('[data-checkbox-group]').forEach((group) => {
  updateFavouriteAllState(group);

  const header = group.querySelector('.ds-table-cell[data-favourite-all] .ds-table-cell__icon[data-icon="save"]');
  if (header) {
    header.addEventListener('click', () => {
      const allSaved = header.getAttribute('data-saved') === 'true';
      group.querySelectorAll('.ds-table-row .ds-table-cell[data-type="icon-cell"] .ds-table-cell__icon[data-icon="save"]').forEach((icon) => {
        icon.setAttribute('data-saved', String(allSaved));
      });
      updateFavouriteAllState(group);
    });
  }

  /*
    Bug fix (2026-09-10, found by direct user report "Bulk save on analysed
    table does not work"): clicking the header icon itself is handled by
    the dedicated header-click listener above, which already calls
    updateFavouriteAllState(group) at its own end. But table-cell/
    component.js's generic favourite-click listener (attached to this same
    icon span, runs first per script order) ALSO synchronously dispatches
    this same ds-table-cell-favourite-toggle event as part of flipping the
    header icon's own data-saved -- and that dispatch reaches this group
    listener BEFORE the header-click listener above gets to run (same
    click, same element, two listeners: dispatchEvent from inside the
    first one fires synchronously and fully resolves before control
    returns to fire the second). Without this guard, updateFavouriteAllState
    ran here first, before any row had actually changed, and derived the
    header's state from row-only data -- overwriting the "true" the click
    had just set on the header back to "false" -- so by the time the
    header-click listener above read header.getAttribute('data-saved'), it
    read the wrong, prematurely-recomputed value and cascaded "false" to
    every row instead of "true". Skipping recompute when the event's own
    target *is* the header icon leaves that case entirely to the header-
    click listener's own trailing updateFavouriteAllState call, and still
    recomputes normally for every real row-level toggle.
  */
  group.addEventListener('ds-table-cell-favourite-toggle', (event) => {
    if (event.target === header) return;
    updateFavouriteAllState(group);
  });
});

/*
  Row reordering: Collection and Snippet instances carry an icon cell
  in the reorder-handle position, using Penpot's own "Drag" asset
  (icons/drag.svg) as-is -- its glyph reads visually as up/down sort
  arrows rather than a conventional grip handle (verified via MCP export),
  but it's what Penpot actually defines for this slot, so it's used
  unmodified rather than substituted with a hand-drawn look-alike, on
  explicit request. Made it actually function as a drag handle: rows can
  be dragged up/down past their siblings to reorder. Not from Penpot -- a
  static design tool doesn't model drag-and-drop -- but the same category
  of addition as the row-select checkbox swap above (a functional gap, not
  invented decoration), and scoped only to rows that actually carry the
  handle, same reasoning as checkbox-cell's click-to-select being scoped
  to cells that actually carry the checkbox icon.

  Native HTML5 drag-and-drop, gated on the handle rather than the whole
  row: `draggable` is set on the row only while the pointer is down on its
  own handle (mousedown/mouseup), so grabbing anywhere else in the row
  (text, buttons, inputs) never starts a drag. dragover on a sibling row
  moves the dragged row before/after it depending on which half of the
  sibling's own height the pointer is over, giving continuous reorder
  feedback as the pointer moves rather than only resolving on drop.

  Bug fix (2026-09-12, found by direct user report "drag still does not
  work, I cannot drag items"): every real consumer of table-row wraps its
  rows in a CSS grid with `.ds-table-row { display: contents }` (see this
  file's own demo.html comment, and every consumer page's table CSS) so
  each row's .ds-table-cell children become the grid's direct items. A
  `display: contents` element generates no box at all -- three different
  things below were done to `row` itself and silently did nothing as a
  result, never caught because table-row's own a11y_notes already flagged
  "not verified in a browser this session":
    1. `row.draggable = true` -- a native drag can only start from an
       element with an actual rendered box to grab; `row` has none, so
       dragstart never fired regardless of mousedown/handle state.
    2. `row.getBoundingClientRect()` in the dragover handler below --
       returns an all-zero rect for a display:contents element, so the
       before/after split was computed from garbage even on a browser
       that somehow got past (1).
    3. `.ds-table-row.ds-table-row--dragging { opacity: 0.5 }`
       (style.css) -- paints nothing, same reason.
  Fixed the same way this file's own updateSelectAllState/
  [data-selected] precedent already fixes the identical box-model
  problem elsewhere: operate on `handle` (a real, boxed element) for
  anything that needs an actual box, and on `row`'s own .ds-table-cell
  children when a rect specifically representing the row's full width
  span is needed -- `row` itself only ever holds the dragging class and
  is targeted by DOM methods (classList, insertBefore) that don't care
  whether it has a box.
*/
document.querySelectorAll('.ds-table-row').forEach((row) => {
  const handle = row.querySelector(':scope > .ds-table-cell[data-type="checkbox-cell"] .ds-table-cell__icon[data-icon="drag"]');
  if (!handle) return;

  handle.addEventListener('mousedown', () => {
    handle.draggable = true;
    // dragend only fires if a drag actually started -- a mousedown on the
    // handle followed by a plain click-and-release (no movement) would
    // otherwise leave handle.draggable stuck true, letting an unrelated
    // later drag gesture anywhere else on the handle start a native
    // browser drag.
    document.addEventListener('mouseup', () => { handle.draggable = false; }, { once: true });
  });

  row.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    row.classList.add('ds-table-row--dragging');
  });

  row.addEventListener('dragend', () => {
    handle.draggable = false;
    row.classList.remove('ds-table-row--dragging');
  });

  row.addEventListener('dragover', (e) => {
    const dragging = row.parentElement.querySelector('.ds-table-row--dragging');
    if (!dragging || dragging === row) return;
    e.preventDefault();
    const cell = row.querySelector(':scope > .ds-table-cell');
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    const isBefore = e.clientY - rect.top < rect.height / 2;
    row.parentElement.insertBefore(dragging, isBefore ? row : row.nextSibling);
  });
});
