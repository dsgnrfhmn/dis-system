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

  Keyboard (explicit request 2026-10-03, the listbox keys the a11y notes
  listed as missing): ArrowDown / ArrowUp on the closed trigger open the
  menu; inside the open menu they move focus between the enabled items,
  Home / End jump to the first / last. Opening from the keyboard (Enter /
  Space on the trigger, or an arrow) focuses the selected item, else the
  first. Enter / Space pick the focused item (native button click). Tab
  closes the menu and lets focus move on. A close while focus is inside
  the menu (a pick, Escape) hands focus back to the trigger, so it isn't
  dropped onto the page body.

  Re-rendered items (explicit request 2026-10-22, a consumer's Portfolio: the
  project list is read anew from Drive while the page is open): the host may
  replace the menu's items at any time. Clicks are taken on the menu and the
  items are looked up on every use, so new items work without a re-init.
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
  const items = () => Array.from(menu.querySelectorAll('.ds-dropdown-menu__item'));
  const multiple = menu.hasAttribute('data-multiple');
  const hover = root.dataset.openOn === 'hover';

  // The item matching the trigger's current text is the selected one (drawn
  // Medium in Figma, node 45:6594). Kept in sync on every pick.
  function markSelected(label) {
    items().forEach((item) => {
      item.setAttribute('aria-selected', item.textContent.trim() === label ? 'true' : 'false');
    });
  }
  if (valueEl && !multiple) markSelected(valueEl.textContent.trim());

  function enabledItems() {
    return items().filter((item) => !item.disabled);
  }

  function focusItem(index) {
    const enabled = enabledItems();
    if (!enabled.length) return;
    enabled[(index + enabled.length) % enabled.length].focus();
  }

  // The item to land on when the menu opens from the keyboard: the current
  // choice if it's selectable, else the first.
  function focusInitialItem() {
    const enabled = enabledItems();
    const selected = enabled.find((item) => item.getAttribute('aria-selected') === 'true');
    (selected || enabled[0])?.focus();
  }

  function close() {
    const hadFocus = menu.contains(document.activeElement);
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutsideClick);
    document.removeEventListener('keydown', onKeydown);
    if (hadFocus) trigger.focus();
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
      return;
    }
    if (event.key === 'Tab') {
      close();
      return;
    }
    const enabled = enabledItems();
    const current = enabled.indexOf(document.activeElement);
    const target = {
      ArrowDown: current === -1 ? 0 : current + 1,
      ArrowUp: current === -1 ? enabled.length - 1 : current - 1,
      Home: 0,
      End: enabled.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    focusItem(target);
  }

  trigger.setAttribute('aria-expanded', 'false');

  // detail === 0: the click came from Enter / Space, not a pointer.
  trigger.addEventListener('click', (event) => {
    if (menu.hidden) {
      open();
      if (event.detail === 0) focusInitialItem();
    } else if (!hover) close();
  });

  // Hover mode (data-open-on="hover" on the wrapper, explicit request
  // 2026-10-20, For You's Recent Activity): the menu opens when the pointer
  // enters the trigger or the menu and closes shortly after it leaves both.
  // The delay carries the pointer across the gap between trigger and panel.
  // A click on the trigger only opens; it never closes what hover just opened.
  if (hover) {
    let timer;
    root.addEventListener('mouseenter', () => {
      clearTimeout(timer);
      if (menu.hidden) open();
    });
    root.addEventListener('mouseleave', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!menu.contains(document.activeElement)) close();
      }, 200);
    });
  }

  trigger.addEventListener('keydown', (event) => {
    if (!menu.hidden || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    event.preventDefault();
    open();
    focusInitialItem();
  });

  menu.addEventListener('click', (event) => {
    const item = event.target.closest('.ds-dropdown-menu__item');
    if (!item || !menu.contains(item) || item.disabled) return;
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
            values: items().filter((i) => i.getAttribute('aria-selected') === 'true').map((i) => i.dataset.value),
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
}

document.querySelectorAll('.ds-dropdown').forEach(initDropdown);
