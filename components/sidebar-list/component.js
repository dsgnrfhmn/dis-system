/*
  sidebar-list

  The collapse toggle. Expanded sidebar: the toggle collapses it to its 64px
  strip (data-collapsed="true"). Collapsed sidebar: the toggle slides the full
  panel open OVER the page (data-peek="true", the page layout does not move)
  and closes it again. A click outside the panel, Escape, and choosing a set or
  a create row inside it also close it. aria-expanded and the label follow the
  visible state.

  Hover (requested 2026-10-13): a collapsed sidebar also opens when the mouse
  enters it, anywhere on the strip or the panel, and closes when the mouse
  leaves, the same data-peek state the toggle sets. Mouse only (touch has no
  hover and keeps the toggle). Clicking the toggle while the
  mouse is over the open panel pins the sidebar open (2026-10-18; it used to only
  close the panel, so a collapsed sidebar could not be pinned again by mouse).

  Dispatches ds-sidebar-list-toggle (bubbles, detail: { collapsed, peek }) so a
  host page can react (e.g. persist it). `collapsed` is the in-flow state.

  Motion (explicit request 2026-10-25, "super smooth"): collapsing and pinning open
  change the sidebar's place in the page flow at once, so the page is laid out once;
  the elements after it in its row then slide from where they were to where they are
  (a transform, 200ms, the curve of the panel's own edge in style.css), which the
  compositor runs without laying the page out again on every frame. Not under
  prefers-reduced-motion.
*/
(function () {
  function setLabel(sidebar) {
    const toggle = sidebar.querySelector('.ds-sidebar-list__toggle');
    if (!toggle) return;
    const open = sidebar.dataset.collapsed !== 'true' || sidebar.dataset.peek === 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', sidebar.dataset.collapsed !== 'true' ? 'Collapse sidebar' : 'Expand sidebar');
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

  const MOVE_MS = 200;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Runs change(), which moves the sidebar's edge in the page flow, and slides what
  // follows it in its row from its old place to its new one.
  function slideFlow(sidebar, change) {
    const row = sidebar.parentElement;
    const after = [];
    for (let el = sidebar.nextElementSibling; el; el = el.nextElementSibling) after.push(el);
    if (reduced() || !row || !after.length || !after[0].animate) {
      change();
      return;
    }
    const before = after.map((el) => el.getBoundingClientRect().left);
    change();
    const moves = after.map((el, i) => [el, before[i] - el.getBoundingClientRect().left]).filter(([, dx]) => Math.abs(dx) > 0.5);
    if (!moves.length) return;
    // While they slide, nothing sticks out past the row, and the panel stays on top.
    const overflow = row.style.overflowX;
    row.style.overflowX = 'clip';
    sidebar.dataset.moving = '';
    const runs = moves.map(([el, dx]) => el.animate(
      [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }],
      { duration: MOVE_MS, easing: 'ease' }
    ).finished.catch(() => {}));
    Promise.all(runs).then(() => {
      row.style.overflowX = overflow;
      delete sidebar.dataset.moving;
    });
  }

  document.querySelectorAll('.ds-sidebar-list__toggle').forEach((toggle) => {
    toggle.addEventListener('click', (event) => {
      const sidebar = toggle.closest('.ds-sidebar-list');
      if (sidebar.dataset.collapsed === 'true') {
        // Collapsed: the toggle pins the sidebar open again (back in the page flow), whether
        // or not the mouse had already opened it over the page. Touch has no hover, so its
        // first tap still only slides the panel open; the next tap pins it.
        if (event.pointerType === 'touch' && sidebar.dataset.peek !== 'true') {
          sidebar.dataset.peek = 'true';
        } else {
          slideFlow(sidebar, () => {
            sidebar.dataset.collapsed = 'false';
            delete sidebar.dataset.peek;
          });
        }
      } else {
        slideFlow(sidebar, () => {
          sidebar.dataset.collapsed = 'true';
          delete sidebar.dataset.peek;
        });
      }
      setLabel(sidebar);
      notify(sidebar);
    });
  });

  document.querySelectorAll('.ds-sidebar-list').forEach((sidebar) => {
    sidebar.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse' || sidebar.dataset.collapsed !== 'true') return;
      if (sidebar.dataset.peek === 'true') return;
      sidebar.dataset.peek = 'true';
      setLabel(sidebar);
      notify(sidebar);
    });
    sidebar.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'mouse') return;
      closePeek(sidebar);
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
