/*
  table-preview

  Host wiring for the composed components, which only report what the user
  did (table-header-cell's filter / sort events, dropdown-menu's select):

  - Type filter (the Type column's header, data-preview-filter="type"):
    shows the chosen type's table and hides the others; the first item
    ("All", value "") shows the first table. Every table has its own Type
    header, so the newly shown one is set to the same choice. Dispatches
    ds-table-preview-type-change (bubbles, detail: { type }).
  - Status filter (data-preview-filter="status"): hides the rows of that
    table whose data-status differs; "" shows them all.
  - Sorting (a sortable header): reorders that table's rows by the
    column's text -- dd.mm.yyyy dates by date -- asc / desc, and back to
    the original order on "none".
  - A row's Status dropdown: sets the row's data-status, which is what
    colors its status pill (table-row/style.css).
*/
(function () {

function syncFilterCell(cell, value) {
  const trigger = cell.querySelector('.ds-table-header-cell__filter-btn');
  cell.dataset.filterValue = value;
  if (trigger) trigger.dataset.filterActive = String(value !== '');
  cell.querySelectorAll('.ds-dropdown-menu__item').forEach((item) => {
    item.setAttribute('aria-selected', String((item.dataset.value || '') === value));
  });
}

function sortKey(cell) {
  const text = cell ? cell.textContent.trim() : '';
  const date = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return date ? `${date[3]}-${date[2]}-${date[1]}` : text.toLowerCase();
}

document.querySelectorAll('.ds-table-preview').forEach((preview) => {
  const tables = Array.from(preview.querySelectorAll('.ds-table-preview__table'));
  const firstType = tables.length ? tables[0].dataset.previewType : '';

  tables.forEach((table) => {
    table.querySelectorAll('.ds-table-row').forEach((row, index) => {
      row.dataset.previewOrder = String(index);
    });
  });

  function showType(type) {
    tables.forEach((table) => {
      table.hidden = table.dataset.previewType !== type;
    });
    preview.dataset.activeType = type;
    const value = type === firstType ? '' : type;
    preview.querySelectorAll('[data-preview-filter="type"] .ds-table-header-cell').forEach((cell) => {
      syncFilterCell(cell, value);
    });
    preview.dispatchEvent(new CustomEvent('ds-table-preview-type-change', {
      bubbles: true,
      detail: { type },
    }));
  }

  preview.addEventListener('ds-table-header-cell-filter', (event) => {
    const wrapper = event.target.closest('[data-preview-filter]');
    if (!wrapper) return;
    const value = event.detail.value || '';
    if (wrapper.dataset.previewFilter === 'type') {
      showType(value || firstType);
    } else if (wrapper.dataset.previewFilter === 'status') {
      const table = wrapper.closest('.ds-table-preview__table');
      table.querySelectorAll('.ds-table-row').forEach((row) => {
        row.hidden = value !== '' && row.dataset.status !== value;
      });
    }
  });

  preview.addEventListener('ds-table-header-cell-sort', (event) => {
    const table = event.target.closest('.ds-table-preview__table');
    const header = event.target.closest('.ds-table-header-cell');
    if (!table || !header) return;
    // The header cell's column: its position among the table's header
    // cells (grid items before the first row; filter wrappers count as one).
    const heads = Array.from(table.children).filter((el) => !el.classList.contains('ds-table-row'));
    const column = heads.findIndex((el) => el === header || el.contains(header));
    const rows = Array.from(table.querySelectorAll(':scope > .ds-table-row'));
    const dir = event.detail.direction;
    rows.sort((a, b) => {
      if (dir === 'none') return Number(a.dataset.previewOrder) - Number(b.dataset.previewOrder);
      const ka = sortKey(a.children[column]);
      const kb = sortKey(b.children[column]);
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * (dir === 'desc' ? -1 : 1);
    });
    rows.forEach((row) => table.appendChild(row));
  });

  preview.addEventListener('ds-dropdown-select', (event) => {
    const row = event.target.closest('.ds-table-row');
    if (!row || !event.target.closest('.ds-table-cell[data-type="dropdown"]')) return;
    row.dataset.status = event.detail.value;
  });
});

})();
