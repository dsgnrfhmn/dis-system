/*
  empty-state

  Only behavior: load the optional icon's real SVG, same
  document.currentScript-relative pattern every icon-bearing component in
  this repo shares (see table-cell/component.js's own comment on why a
  page-relative fetch doesn't work once this repo is vendored as a
  submodule at arbitrary depth). The optional action button is a real
  .ds-text-button instance (composed via template.html's include) and
  owns its own click behavior already -- nothing to add here for it.
*/

(function () {
  const ICONS_BASE = new URL('../../icons/', document.currentScript.src);
  document.querySelectorAll('.ds-empty-state__icon[data-icon]').forEach(async (el) => {
    try {
      const res = await fetch(new URL(`${el.dataset.icon}.svg`, ICONS_BASE));
      el.innerHTML = await res.text();
    } catch (err) {
      // icons/ unreachable (e.g. opened without a server) -- leave empty
    }
  });
})();
