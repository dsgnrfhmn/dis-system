/*
  header-tab

  Each instance is composed independently by the consumer (see meta.json --
  unlike table-header's own type="2-tabs", which owns both labels inside
  one shared template), so the click-switch group is discovered via the
  nearest ancestor carrying role="tablist" (the consumer's own wrapping
  row), not a component-owned container. Same generic active/inactive
  switch table-header's own tab click already implements (see that
  component's own component.js), scoped per tablist ancestor instead of
  per .ds-table-header instance.
*/

document.querySelectorAll('.ds-header-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const tablist = tab.closest('[role="tablist"]');
    if (!tablist) return;
    const siblings = tablist.querySelectorAll(':scope > .ds-header-tab');
    siblings.forEach((t) => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
    tablist.dispatchEvent(new CustomEvent('ds-header-tab-change', {
      bubbles: true,
      detail: { selected: tab },
    }));
  });
});
