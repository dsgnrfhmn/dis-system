/*
  sidebar-list

  The collapse toggle. Expanded sidebar: the toggle collapses it to its 64px
  strip (data-collapsed="true"). Collapsed sidebar: the toggle slides the full
  panel open OVER the page (data-peek="true", the page layout does not move)
  and closes it again. A click outside the panel, Escape, and choosing a set or
  a create row inside it also close it. aria-expanded and the label follow the
  visible state.

  Dispatches ds-sidebar-list-toggle (bubbles, detail: { collapsed, peek }) so a
  host page can react (e.g. persist it). `collapsed` is the in-flow state.
*/
(function () {
  function setLabel(sidebar) {
    const toggle = sidebar.querySelector('.ds-sidebar-list__toggle');
    if (!toggle) return;
    const open = sidebar.dataset.collapsed !== 'true' || sidebar.dataset.peek === 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Collapse sidebar' : 'Expand sidebar');
  }

  function notify(sidebar) {
    const toggle = sidebar.querySelector('.ds-sidebar-list__toggle');
    if (!toggle) return;
    toggle.dispatchEvent(new CustomEvent('ds-sidebar-list-toggle', {
      bubbles: true,
      detail: { collapsed: sidebar.dataset.collapsed === 'true', peek: sidebar.dataset.peek === 'true' },
    }));
  }

  function closePeek(sidebar) {
    if (sidebar.dataset.peek !== 'true') return;
    delete sidebar.dataset.peek;
    setLabel(sidebar);
    notify(sidebar);
  }

  document.querySelectorAll('.ds-sidebar-list__toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const sidebar = toggle.closest('.ds-sidebar-list');
      if (sidebar.dataset.collapsed === 'true') {
        if (sidebar.dataset.peek === 'true') delete sidebar.dataset.peek;
        else sidebar.dataset.peek = 'true';
      } else {
        sidebar.dataset.collapsed = 'true';
        delete sidebar.dataset.peek;
      }
      setLabel(sidebar);
      notify(sidebar);
    });
  });

  function peeking() {
    return document.querySelectorAll('.ds-sidebar-list[data-collapsed="true"][data-peek="true"]');
  }

  document.addEventListener('click', (event) => {
    peeking().forEach((sidebar) => {
      if (!sidebar.contains(event.target)) closePeek(sidebar);
      else if (event.target.closest('[data-select-set], [data-popup-open]')) closePeek(sidebar);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    peeking().forEach(closePeek);
  });
})();
