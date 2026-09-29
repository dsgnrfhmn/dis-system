/*
  sidebar-list

  The collapse toggle: flips data-collapsed on its own sidebar, keeps
  aria-expanded and the label in step, and dispatches ds-sidebar-list-toggle
  (bubbles, detail: { collapsed }) so a host page can react (e.g. persist it).
*/
document.querySelectorAll('.ds-sidebar-list__toggle').forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const sidebar = toggle.closest('.ds-sidebar-list');
    const collapsed = sidebar.dataset.collapsed !== 'true';
    sidebar.dataset.collapsed = String(collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    toggle.dispatchEvent(new CustomEvent('ds-sidebar-list-toggle', { bubbles: true, detail: { collapsed } }));
  });
});
