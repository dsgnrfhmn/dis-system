/*
  dropdown-menu — generic open/close/select behavior for any trigger paired
  with this menu inside a .ds-dropdown wrapper:

    <div class="ds-dropdown">
      <button data-dropdown-trigger aria-haspopup="listbox" ...>...</button>
      <div class="ds-dropdown-menu" role="listbox" hidden>
        <button class="ds-dropdown-menu__item" role="option" data-value="x">Label</button>
        ...
      </div>
    </div>

  Not from Penpot -- static design tools don't model floating-layer
  interaction. This is the minimum needed for the menu to actually work:
  toggle on trigger click, close on outside click / Escape, select an item
  -> dispatch ds-dropdown-select and close. If the trigger has a
  [data-dropdown-value] descendant, its text is updated to the selected
  item's label (input-dropdown's index.html does this).

  Multiple (a menu with data-multiple, template prop multiple=true; explicit
  request 2026-10-01, a status filter that shows several statuses at once):
  each item is a checkbox. A click toggles that item's aria-selected and
  leaves the menu open, so several can be ticked in one go; the trigger's
  text is not touched. ds-dropdown-select then carries { value, label,
  selected (the item's new state), values (every ticked item's value, in
  menu order) }. data-mixed="true" on an item draws the third, half-ticked
  box (a host's "All" over a partial choice); a click clears it.
*/

// The menu's checkbox glyphs (multiple), inlined from icons/ so they take
// the theme's colors -- same loader pattern as table-header-cell's own, run
// once on load for the menus in the page.
(function () {
  const ICONS_BASE = new URL('../../icons/', document.currentScript.src);
  document.querySelectorAll('.ds-dropdown-menu__check[data-icon]').forEach(async (el) => {
    try {
      const res = await fetch(new URL(`${el.dataset.icon}.svg`, ICONS_BASE));
      el.innerHTML = await res.text();
    } catch (err) {
      // icons/ unreachable (e.g. opened without a server) -- leave empty
    }
  });
})();

function initDropdown(root) {
  const trigger = root.querySelector('[data-dropdown-trigger]');
  const menu = root.querySelector('.ds-dropdown-menu');
  if (!trigger || !menu) return;

  const valueEl = trigger.querySelector('[data-dropdown-value]');
  const items = Array.from(menu.querySelectorAll('.ds-dropdown-menu__item'));
  const multiple = menu.hasAttribute('data-multiple');

  // The item matching the trigger's current text is the selected one (drawn
  // Medium in Figma, node 45:6594). Kept in sync on every pick.
  function markSelected(label) {
    items.forEach((item) => {
      item.setAttribute('aria-selected', item.textContent.trim() === label ? 'true' : 'false');
    });
  }
  if (valueEl && !multiple) markSelected(valueEl.textContent.trim());

  function close() {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutsideClick);
    document.removeEventListener('keydown', onKeydown);
  }

  function open() {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onOutsideClick);
    document.addEventListener('keydown', onKeydown);
  }

  function onOutsideClick(event) {
    if (!root.contains(event.target)) close();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      close();
      trigger.focus();
    }
  }

  trigger.setAttribute('aria-expanded', 'false');

  trigger.addEventListener('click', () => {
    if (menu.hidden) open();
    else close();
  });

  items.forEach((item) => {
    item.addEventListener('click', () => {
      if (multiple) {
        const selected = item.getAttribute('aria-selected') !== 'true';
        item.setAttribute('aria-selected', String(selected));
        item.removeAttribute('data-mixed');
        root.dispatchEvent(
          new CustomEvent('ds-dropdown-select', {
            bubbles: true,
            detail: {
              value: item.dataset.value,
              label: item.textContent.trim(),
              selected,
              values: items.filter((i) => i.getAttribute('aria-selected') === 'true').map((i) => i.dataset.value),
            },
          })
        );
        return;
      }
      if (valueEl) valueEl.textContent = item.textContent;
      markSelected(item.textContent.trim());
      close();
      root.dispatchEvent(
        new CustomEvent('ds-dropdown-select', {
          bubbles: true,
          detail: { value: item.dataset.value, label: item.textContent },
        })
      );
    });
  });
}

document.querySelectorAll('.ds-dropdown').forEach(initDropdown);
