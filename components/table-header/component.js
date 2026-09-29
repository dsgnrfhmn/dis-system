/*
  table-header

  Only the type="2 Tabs" case has real interactive behavior in Penpot's own
  design (an active/inactive pair implies clicking the inactive one selects
  it). Wire that up generically: clicking a tab within a .ds-table-header
  marks it aria-selected="true" and its siblings aria-selected="false".
  type="1 Tab" and "Title + info" contain no .ds-table-header__tab elements,
  so this listener is a no-op for them.
*/

document.querySelectorAll('.ds-table-header').forEach((header) => {
  const tabs = header.querySelectorAll('.ds-table-header__tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
      header.dispatchEvent(new CustomEvent('ds-table-header-tab-change', {
        bubbles: true,
        detail: { selected: tab },
      }));
    });
  });
});
