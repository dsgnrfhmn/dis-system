/*
  header-block -- search button-reveal only (added 2026-09-10, explicit
  request; the rest of this component has no behavior of its own, it's a
  pure layout shell composing table-header/table-header-actions/input).

  Clicking the "Search" trigger hides it and reveals the real input,
  focused immediately. Blurring an empty input reverts back to the
  button, so a table's header bar doesn't permanently lose the actions/
  title space to an empty search field the user opened by accident and
  didn't use. A non-empty input stays open on blur -- collapsing it
  would silently discard a query with no undo, and the consuming app's live
  search listener (data-search-for) needs the input to still exist in
  the DOM to keep filtering while focus moves elsewhere (e.g. to click a
  filtered row).
*/

document.querySelectorAll('.ds-header-block__search').forEach((wrapper) => {
  const trigger = wrapper.querySelector('.ds-text-button');
  const input = wrapper.querySelector('.ds-input');
  if (!trigger || !input) return;

  trigger.addEventListener('click', () => {
    wrapper.dataset.open = 'true';
    input.focus();
  });

  input.addEventListener('blur', () => {
    if (input.value.trim() === '') {
      wrapper.dataset.open = 'false';
    }
  });
});
