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
*/
document.querySelectorAll('.ds-table-header-cell[data-filter]').forEach((cell) => {
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
