/*
  context-menu -- open / close / select wiring for menus opened by a right click.

  Contract:
    <li data-context-menu="row-menu">...</li>              the element that owns the menu
    <div class="ds-dropdown-menu ds-context-menu" id="row-menu" role="menu" hidden>
      <button type="button" class="ds-dropdown-menu__item" role="menuitem" data-value="rename">Rename</button>
      ...
    </div>

  The menu may be shared by many elements (one per list): it is found by id when the
  element is right-clicked, and works for elements added later, since the listener is on
  the document. A right click opens the menu at the pointer, kept inside the viewport, and
  the element gets data-context-open="true" while it is open. The key that opens a context
  menu from the keyboard (Menu, Shift+F10) opens it at the element's lower left corner.

  Choosing an item dispatches ds-context-menu-select on the element (bubbles; detail:
  { value, label, host }) and closes the menu. The component does nothing else: what the
  value means, and any confirmation of a destructive one, is the host page's.

  Closes on Escape, a click or press outside, Tab, a scroll, a resize and a lost window
  focus. While open: ArrowDown / ArrowUp move between the enabled items, Home / End jump,
  Enter / Space pick (native button). Focus goes to the first item on open and back to
  where it was on a close from the keyboard. The browser's own menu stays for everything
  that does not carry data-context-menu.
*/
(function () {
  const MARGIN = 4;
  let current = null;   // { menu, host, from }

  const enabled = (menu) => Array.from(menu.querySelectorAll('[role="menuitem"]:not(:disabled)'));

  function close(refocus) {
    if (!current) return;
    const { menu, host, from } = current;
    current = null;
    menu.hidden = true;
    delete host.dataset.contextOpen;
    if (refocus && from && from.isConnected && typeof from.focus === 'function') from.focus();
  }

  function open(menu, host, x, y) {
    close(false);
    current = { menu, host, from: document.activeElement };
    host.dataset.contextOpen = 'true';
    menu.hidden = false;
    // Measured once shown, then moved so the whole panel stays on screen.
    const box = menu.getBoundingClientRect();
    const left = Math.max(MARGIN, Math.min(x, window.innerWidth - box.width - MARGIN));
    const top = Math.max(MARGIN, Math.min(y, window.innerHeight - box.height - MARGIN));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    const first = enabled(menu)[0];
    if (first) first.focus();
  }

  document.addEventListener('contextmenu', (event) => {
    const host = event.target.closest && event.target.closest('[data-context-menu]');
    const menu = host && document.getElementById(host.dataset.contextMenu);
    if (!menu) {
      close(false);
      return;
    }
    event.preventDefault();
    // From the keyboard the event has no real pointer position.
    const fromKey = event.clientX === 0 && event.clientY === 0;
    const r = host.getBoundingClientRect();
    open(menu, host, fromKey ? r.left : event.clientX, fromKey ? r.bottom : event.clientY);
  });

  document.addEventListener('pointerdown', (event) => {
    if (current && !current.menu.contains(event.target)) close(false);
  }, true);

  document.addEventListener('click', (event) => {
    if (!current) return;
    const item = event.target.closest && event.target.closest('[role="menuitem"]');
    if (!item || !current.menu.contains(item) || item.disabled) return;
    const { host } = current;
    close(true);
    host.dispatchEvent(new CustomEvent('ds-context-menu-select', {
      bubbles: true,
      detail: { value: item.dataset.value, label: item.textContent.trim(), host },
    }));
  });

  document.addEventListener('keydown', (event) => {
    if (!current) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      close(false);
      return;
    }
    const items = enabled(current.menu);
    const at = items.indexOf(document.activeElement);
    const to = {
      ArrowDown: items[(at + 1) % items.length],
      ArrowUp: items[(at - 1 + items.length) % items.length],
      Home: items[0],
      End: items[items.length - 1],
    }[event.key];
    if (!to) return;
    event.preventDefault();
    to.focus();
  }, true);

  window.addEventListener('resize', () => close(false));
  window.addEventListener('blur', () => close(false));
  document.addEventListener('scroll', () => close(false), true);
})();
