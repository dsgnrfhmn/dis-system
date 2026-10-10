/*
  table-header-cell

  Generalizes site.js's own initSampleTableSort, which hardcodes a single
  selector (.sample-table) and reorders that one table's rows directly.
  A reusable component can't own row-reordering itself -- it doesn't know
  the host table's row shape -- so this only cycles data-sort-dir and
  dispatches a bubbling ds-table-header-cell-sort event; the consuming
  page does the actual reorder (same "compose, don't own the host's data"
  precedent as input-dropdown/dropdown-menu's own open/select events).

  Exclusive single-column sort (only one column sorted at a time) needs a
  shared scope to reset sibling header cells against, same problem
  table-row/component.js's own select-all/favourite-all already solved
  with a [data-checkbox-group] container -- mirrored here as
  [data-sort-group]: the host page puts that attribute on whatever
  ancestor wraps one table's full set of header cells.

  Icon loading: this component owns its own loader (same
  document.currentScript-relative pattern every icon-bearing component.js
  in this repo shares -- see table-cell/component.js's own comment on why)
  rather than depending on table-cell's loader, which is scoped to
  .ds-table-cell__icon specifically and wouldn't match this component's
  own .ds-table-header-cell__sort-icon class.
*/

(function () {
  const ICONS_BASE = new URL('../../icons/', document.currentScript.src);
  document.querySelectorAll('.ds-table-header-cell__sort-icon[data-icon]').forEach(async (el) => {
    try {
      const res = await fetch(new URL(`${el.dataset.icon}.svg`, ICONS_BASE));
      el.innerHTML = await res.text();
    } catch (err) {
      // icons/ unreachable (e.g. opened without a server) -- leave empty
    }
  });
})();

document.querySelectorAll('[data-sort-group]').forEach((group) => {
  const buttons = Array.from(group.querySelectorAll('.ds-table-header-cell__sort-btn'));
  const nextDirFor = { none: 'asc', asc: 'desc', desc: 'none' };

  buttons.forEach((btn, columnIndex) => {
    btn.addEventListener('click', () => {
      const nextDir = nextDirFor[btn.dataset.sortDir] || 'asc';
      buttons.forEach((b) => {
        if (b !== btn) b.dataset.sortDir = 'none';
      });
      btn.dataset.sortDir = nextDir;
      btn.dispatchEvent(new CustomEvent('ds-table-header-cell-sort', {
        bubbles: true,
        detail: { columnIndex, direction: nextDir },
      }));
    });
  });
});

/*
  Filter header cells (data-filter): dropdown-menu (a separate component, on
  the page next to this one) opens the menu and dispatches ds-dropdown-select
  on the cell's .ds-dropdown. This only records the choice -- data-filter-value
  on the cell ("" for the first, "everything" item), the accent state on the
  button, aria-selected on the items, aria-label -- and dispatches a bubbling
  ds-table-header-cell-filter, detail { value, label }. Like sorting, the host
  page narrows its own rows: this component does not know their shape.

  Multiple (data-filter-multiple, template prop filter_multiple; explicit
  request 2026-10-01): the menu is dropdown-menu's checkbox list, so several
  values can be shown at once. The first item, "All" (value ""), ticks or
  clears every value and is drawn ticked when all are, half-ticked when only
  some are. The cell keeps the ticked values space-separated in
  data-filter-values; the button is accent ("filtered") while any value is
  left out; the event's detail is { values } (in menu order). The menu stays
  open while ticking (dropdown-menu); Escape or an outside click closes it.
*/
document.querySelectorAll('.ds-table-header-cell[data-filter-multiple]').forEach((cell) => {
  const trigger = cell.querySelector('.ds-table-header-cell__filter-btn');
  const name = cell.querySelector('.ds-table-cell__text');
  if (!trigger || !name) return;
  const items = Array.from(cell.querySelectorAll('.ds-dropdown-menu__item'));
  const allItem = items.find((item) => (item.dataset.value || '') === '');
  const options = items.filter((item) => item !== allItem);

  cell.addEventListener('ds-dropdown-select', (event) => {
    if ((event.detail.value || '') === '') {
      options.forEach((item) => item.setAttribute('aria-selected', String(event.detail.selected)));
    }
    const ticked = options.filter((item) => item.getAttribute('aria-selected') === 'true');
    const all = ticked.length === options.length;
    if (allItem) {
      allItem.setAttribute('aria-selected', String(all));
      if (ticked.length > 0 && !all) allItem.dataset.mixed = 'true';
      else allItem.removeAttribute('data-mixed');
    }
    const values = ticked.map((item) => item.dataset.value);
    cell.dataset.filterValues = values.join(' ');
    trigger.dataset.filterActive = String(!all);
    trigger.setAttribute('aria-label', all ? `Filter by ${name.textContent}` : `Filter by ${name.textContent}: ${ticked.map((item) => item.textContent.trim()).join(', ') || 'none'}`);
    cell.dispatchEvent(new CustomEvent('ds-table-header-cell-filter', {
      bubbles: true,
      detail: { values },
    }));
  });
});

document.querySelectorAll('.ds-table-header-cell[data-filter]:not([data-filter-multiple])').forEach((cell) => {
  const trigger = cell.querySelector('.ds-table-header-cell__filter-btn');
  const name = cell.querySelector('.ds-table-cell__text');
  if (!trigger || !name) return;
  const items = Array.from(cell.querySelectorAll('.ds-dropdown-menu__item'));

  cell.addEventListener('ds-dropdown-select', (event) => {
    const value = event.detail.value || '';
    cell.dataset.filterValue = value;
    trigger.dataset.filterActive = String(value !== '');
    trigger.setAttribute('aria-label', value === '' ? `Filter by ${name.textContent}` : `Filter by ${name.textContent}: ${event.detail.label.trim()}`);
    items.forEach((item) => item.setAttribute('aria-selected', String((item.dataset.value || '') === value)));
    cell.dispatchEvent(new CustomEvent('ds-table-header-cell-filter', {
      bubbles: true,
      detail: { value, label: event.detail.label.trim() },
    }));
  });
});

/*
  Column resize (explicit request 2026-10-01: "change a column's width by
  hovering the edge of its header"). Opt-in on the CSS-grid container that
  holds one table's header cells and rows: data-column-resize, its value a
  key to remember the widths under (empty: not remembered). Every header cell
  in it except the last column gets a handle on its right edge -- the same
  handle as pane's split (8px grab area, 2px accent line on hover, focus and
  while dragging). Dragging moves that column's right border and every column
  after it shares out the difference in proportion, so the table keeps its
  width, nothing shifts past the right edge, and the columns to the left stay
  put. ArrowLeft / ArrowRight on a focused
  handle move it 24px; a double click puts every column back to the CSS's own
  widths.

  Events, so a host can undo a resize: ds-table-columns-resize (bubbles,
  detail { before, after }, px arrays or null for the CSS's widths) after
  each drag, arrow step or reset; and the host sends ds-table-columns-set
  (detail { sizes }) to the container to put sizes back.

  The widths are measured off the grid's resolved columns on the first drag
  and applied as data-columns-resized plus --_column-sizes on the container
  (style.css turns that into grid-template-columns). Each column is stored as
  a proportion (minmax(0, <px>fr)), so a different window width keeps the
  shape the user made. A column never goes under spacing.9 (40px), and one
  marked data-resize-min="content" (on its header cell, or a wrapper around
  it) never under what its content needs (explicit request 2026-10-01: a
  column of buttons / a checkbox / a status can't be squeezed until its
  content no longer fits). Remembered
  in localStorage as "ds-columns:<key>" when it has a key and the column
  count still matches; storage can be missing or throw, and the table then
  just starts as the CSS has it.

  Not sourced from Figma: the design shows fixed columns only.
*/
(function () {
  const KEY_STEP = 24;

  function load(key, count) {
    if (!key) return null;
    try {
      const sizes = JSON.parse(window.localStorage.getItem(`ds-columns:${key}`));
      return Array.isArray(sizes) && sizes.length === count && sizes.every((n) => n > 0) ? sizes : null;
    } catch (error) {
      return null;
    }
  }

  function save(key, sizes) {
    if (!key) return;
    try {
      if (sizes) window.localStorage.setItem(`ds-columns:${key}`, JSON.stringify(sizes));
      else window.localStorage.removeItem(`ds-columns:${key}`);
    } catch (error) {
      // not remembered, the columns still resize
    }
  }

  function initColumnResize(table) {
    const key = table.dataset.columnResize;
    const minWidth = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ds-spacing-9')) || 40;
    // The grid's resolved column widths in px, whatever the CSS wrote.
    const measure = () => getComputedStyle(table).gridTemplateColumns.split(' ').map(parseFloat);
    let sizes = null;

    // Columns whose content must always fit (data-resize-min="content" on a
    // header cell, or on a wrapper around one): their index in the grid.
    const contentColumns = () => new Set(
      [...table.querySelectorAll('[data-resize-min="content"]')]
        .map((el) => (el.matches('.ds-table-cell') ? el : el.querySelector('.ds-table-cell')))
        .filter(Boolean)
        .map((cell) => columnOf(cell))
        .filter((i) => i >= 0)
    );

    // Each column's least width: spacing.9, or for a content column the
    // width its content needs right now -- measured by laying the grid out
    // once with those columns at max-content (synchronous, never painted).
    function minimums(count) {
      const floor = minWidth();
      const content = contentColumns();
      if (content.size === 0) return Array(count).fill(floor);
      const tracks = Array.from({ length: count }, (_, j) => (content.has(j) ? 'max-content' : 'minmax(0, 1fr)'));
      table.style.gridTemplateColumns = tracks.join(' ');
      const needed = measure();
      table.style.removeProperty('grid-template-columns');
      return needed.map((w, j) => (content.has(j) ? Math.max(floor, Math.ceil(w)) : floor));
    }

    // A content column keeps max-content as its CSS floor too, so content
    // that grows later (a longer button label) still fits.
    function apply(next) {
      sizes = next;
      const content = contentColumns();
      table.dataset.columnsResized = '';
      table.style.setProperty('--_column-sizes', next.map((px, j) => `minmax(${content.has(j) ? 'max-content' : '0'}, ${px.toFixed(2)}fr)`).join(' '));
    }

    function reset() {
      sizes = null;
      delete table.dataset.columnsResized;
      table.style.removeProperty('--_column-sizes');
      save(key, null);
    }

    // Tell the host what changed, so it can offer it back (the JOBS page's
    // Ctrl+Z): before / after are the column sizes in px, or null for the
    // CSS's own widths.
    function changed(before) {
      const after = sizes ? sizes.slice() : null;
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      table.dispatchEvent(new CustomEvent('ds-table-columns-resize', { bubbles: true, detail: { before, after } }));
    }

    // And take sizes back from the host: ds-table-columns-set with
    // detail.sizes (px, or null for the CSS's widths). No resize event
    // follows -- this is the host's own change.
    table.addEventListener('ds-table-columns-set', (event) => {
      const next = event.detail && event.detail.sizes;
      if (next) {
        apply(next);
        save(key, sizes);
      } else reset();
    });

    // Which column a header cell is: the track its right edge closes.
    function columnOf(cell) {
      const right = cell.getBoundingClientRect().right - table.getBoundingClientRect().left;
      let edge = 0;
      const tracks = measure();
      for (let i = 0; i < tracks.length; i += 1) {
        edge += tracks[i];
        if (Math.abs(edge - right) < 2) return i;
      }
      return -1;
    }

    // Column i's right border moved by dx px from `start`. Every column to
    // its right takes up the difference in proportion (explicit request
    // 2026-10-01: resizing one column moves the ones after it, rather than
    // only the next): giving room, each one gives in proportion to how far
    // it is above the minimum, so none drops under it; taking room, each
    // grows in proportion to its width. Columns to the left never move.
    // mins: each column's least width (minimums()).
    function moved(start, i, dx, mins) {
      const right = start.slice(i + 1);
      const slackOf = (w, k) => Math.max(0, w - mins[i + 1 + k]);
      const slack = right.reduce((sum, w, k) => sum + slackOf(w, k), 0);
      const total = right.reduce((sum, w) => sum + w, 0);
      const delta = Math.max(Math.min(0, mins[i] - start[i]), Math.min(slack, dx));
      const next = start.slice();
      next[i] = start[i] + delta;
      right.forEach((w, k) => {
        const share = delta > 0 ? (slack ? slackOf(w, k) / slack : 0) : (total ? w / total : 0);
        next[i + 1 + k] = w - delta * share;
      });
      return next;
    }

    const stored = load(key, measure().length);
    if (stored) apply(stored);

    table.querySelectorAll('.ds-table-header-cell').forEach((cell) => {
      const handle = document.createElement('span');
      handle.className = 'ds-table-header-cell__resize';
      handle.tabIndex = 0;
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-orientation', 'vertical');
      const name = cell.querySelector('.ds-table-cell__text');
      handle.setAttribute('aria-label', `Resize ${(name && name.textContent.trim()) || 'column'}`);
      cell.appendChild(handle);

      let drag = null;
      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        const i = columnOf(cell);
        const start = measure();
        if (i < 0 || i >= start.length - 1) return;
        drag = { x: event.clientX, i, start, mins: minimums(start.length), before: sizes ? sizes.slice() : null };
        handle.setPointerCapture(event.pointerId);
        table.dataset.columnDragging = 'true';
        event.preventDefault();
        event.stopPropagation();
      });
      handle.addEventListener('pointermove', (event) => {
        if (drag) apply(moved(drag.start, drag.i, event.clientX - drag.x, drag.mins));
      });
      const finish = () => {
        if (!drag) return;
        const { before } = drag;
        drag = null;
        delete table.dataset.columnDragging;
        save(key, sizes);
        changed(before);
      };
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
      // The handle sits over the header's own sort / filter button.
      handle.addEventListener('click', (event) => event.stopPropagation());
      handle.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        const before = sizes ? sizes.slice() : null;
        reset();
        changed(before);
      });
      handle.addEventListener('keydown', (event) => {
        const dx = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[event.key];
        if (dx === undefined) return;
        const i = columnOf(cell);
        const start = measure();
        if (i < 0 || i >= start.length - 1) return;
        event.preventDefault();
        const before = sizes ? sizes.slice() : null;
        apply(moved(start, i, dx, minimums(start.length)));
        save(key, sizes);
        changed(before);
      });
    });

    // The last column has no border to its right: no handle there.
    const last = measure().length - 1;
    table.querySelectorAll('.ds-table-header-cell__resize').forEach((handle) => {
      if (columnOf(handle.parentElement) >= last) handle.hidden = true;
    });
  }

  // A table that has no layout yet (a tab panel that is not shown) has no
  // resolved columns to measure: the remembered widths would not match and the
  // last column would keep its handle. It is set up when it first gets a box.
  document.querySelectorAll('[data-column-resize]').forEach((table) => {
    if (table.getClientRects().length > 0 || typeof ResizeObserver === 'undefined') {
      initColumnResize(table);
      return;
    }
    const watch = new ResizeObserver(() => {
      if (table.getClientRects().length === 0) return;
      watch.disconnect();
      initColumnResize(table);
    });
    watch.observe(table);
  });
})();
