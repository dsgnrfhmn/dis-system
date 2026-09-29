/*
  input-dropdown
  - [data-icon]: loads icons/arrow-down.svg and inlines it (same mechanism as
    table-cell, see its component.js) so fill="currentColor" picks up this
    element's `color` and repaints correctly per theme.
  - Dispatches a custom event on click so a host page can open its own
    menu/listbox without this component knowing about it (matching
    table-cell's dropdown pattern).
*/

// Wrapped in an IIFE so this file's top-level ICONS_BASE doesn't collide
// with the identically-named top-level const other component.js files
// declare -- classic (non-module) <script> tags share one global scope, so
// a consumer page loading more than one of these scripts together would
// otherwise hit "Identifier 'ICONS_BASE' has already been declared".
(function () {

// Icon base path resolved from this script's own URL, not the page's --
// see table-cell/component.js's header comment for why a plain relative
// fetch("../../icons/...") isn't submodule-safe.
const ICONS_BASE = new URL('../../icons/', document.currentScript.src);

document.querySelectorAll('.ds-input-dropdown__icon[data-icon]').forEach(async (el) => {
  try {
    const res = await fetch(new URL(`${el.dataset.icon}.svg`, ICONS_BASE));
    el.innerHTML = await res.text();
  } catch (err) {
    // icons/ unreachable (e.g. opened without a server) -- leave empty
  }
});

// A choice replaces the prompt: dropdown-menu dispatches ds-dropdown-select
// on its .ds-dropdown wrapper, which holds this trigger, so the placeholder
// look (data-placeholder, 50% label) ends there without dropdown-menu
// knowing about it.
document.addEventListener('ds-dropdown-select', (event) => {
  const trigger = event.target.querySelector && event.target.querySelector('.ds-input-dropdown[data-placeholder]');
  if (trigger) trigger.removeAttribute('data-placeholder');
});

document.querySelectorAll('.ds-input-dropdown').forEach((el) => {
  el.addEventListener('click', () => {
    el.dispatchEvent(new CustomEvent('ds-input-dropdown-open', { bubbles: true }));
  });
});

})();
