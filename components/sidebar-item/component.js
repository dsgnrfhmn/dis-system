/*
  sidebar-item
  [data-icon]: loads icons/<name>.svg (save) and inlines it -- same fetch-and-
  inline mechanism every icon-bearing component in this system uses (see
  table-cell/component.js), so fill="currentColor" picks up this
  element's own `color`.
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

document.querySelectorAll('.ds-sidebar-item__icon[data-icon], .ds-sidebar-item__save-icon[data-icon]').forEach(async (el) => {
  try {
    const res = await fetch(new URL(`${el.dataset.icon}.svg`, ICONS_BASE));
    el.innerHTML = await res.text();
  } catch (err) {
    // icons/ unreachable (e.g. opened without a server) -- leave empty
  }
});

/*
  Save toggle (A8, type="set" only -- explicit consumer requirement, not from
  Penpot): unlike type="card"'s deliberately inert icon (Penpot's own
  source shows no affordance on it), a collection/template set's save icon needs
  to actually toggle (the consumer spec). Same click-toggle-
  and-bubble pattern table-cell/component.js already established for its
  own favourite icon-cell, reused here rather than re-derived.
*/
document.querySelectorAll('.ds-sidebar-item[data-type="set"] .ds-sidebar-item__save').forEach((save) => {
  save.addEventListener('click', () => {
    const saved = save.getAttribute('aria-pressed') === 'true';
    save.setAttribute('aria-pressed', String(!saved));
    save.dispatchEvent(new CustomEvent('ds-sidebar-item-favourite-toggle', {
      bubbles: true,
      detail: { saved: !saved },
    }));
  });
});

})();
