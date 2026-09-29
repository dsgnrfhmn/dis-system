/*
  nav-bar

  Two behaviors, neither from Penpot -- a static design tool doesn't model
  either, but both are the same category of addition table-header's tab
  click-swap and table-row's row-select already are: closing a real
  functional gap, not invented decoration.

  - Center page links: clicking one marks it data-priority="primary" (the
    current page's own visual signal in Penpot's real data) and the rest
    "secondary", plus aria-current="page" on the one now current. Mirrors
    table-header's tab click-swap exactly, just keyed off data-priority
    instead of aria-selected since that's the token this component's
    actual "current page" signal already uses.
  - Theme toggle: as of 2026-09-04 this is a real .ds-text-button instance
    (icon+label variant, explicit request -- see meta.json), not a
    bespoke button, so its initial [data-icon] glyph load is already
    handled by text-button/component.js's own `.ds-text-button__icon
    [data-icon]` loader (loaded alongside this file in index.html) --
    doing it again here would just be a redundant duplicate fetch. This
    file only owns what text-button's own component.js can't know about:
    swapping the icon+label between theme-dark/theme-light on click (icon
    shows the theme a click switches TO, matching the root page's own
    site.js convention) and dispatching ds-nav-bar-theme-toggle so a host
    page can apply the actual theme -- this component has no opinion on
    how theming is implemented site-wide, same reasoning dropdown-menu's
    open event and table-cell's dropdown-open event already follow. The
    visible ".ds-nav-bar__theme-label" text ("Dark"/"Light") tracks the
    icon 1:1 (same target-theme convention) and, combined with
    .ds-text-button's own native <button> semantics, is the button's
    accessible name -- no separate aria-label needed (WCAG 2.5.3 Label in
    Name: visible and accessible names never diverge).
*/

// Wrapped in an IIFE so this file's top-level ICONS_BASE doesn't collide
// with the identically-named top-level const other component.js files
// declare -- classic (non-module) <script> tags share one global scope, so
// a consumer page loading more than one of these scripts together would
// otherwise hit "Identifier 'ICONS_BASE' has already been declared".
(function () {

// Icon base path resolved from this script's own URL, not the page's --
// see table-cell/component.js's header comment for why a plain relative
// fetch("../../icons/...") isn't submodule-safe. Captured here, at
// script-load time, since document.currentScript is only valid outside
// an await -- the theme-toggle handler below fires long after load.
const ICONS_BASE = new URL('../../icons/', document.currentScript.src);

document.querySelectorAll('.ds-nav-bar').forEach((navBar) => {
  const links = navBar.querySelectorAll('.ds-nav-bar__center .ds-text-button');
  links.forEach((link) => {
    link.addEventListener('click', () => {
      links.forEach((l) => {
        const isCurrent = l === link;
        l.dataset.priority = isCurrent ? 'primary' : 'secondary';
        if (isCurrent) {
          l.setAttribute('aria-current', 'page');
        } else {
          l.removeAttribute('aria-current');
        }
      });
    });
  });

  const themeToggle = navBar.querySelector('.ds-nav-bar__theme-toggle');
  const themeIcon = navBar.querySelector('.ds-nav-bar__theme-icon');
  const themeLabel = navBar.querySelector('.ds-nav-bar__theme-label');
  if (!themeToggle || !themeIcon || !themeLabel) return;

  themeToggle.addEventListener('click', async () => {
    // The icon always shows the theme a click switches TO (see header
    // comment) -- so whichever icon is showing right now IS the theme
    // this click activates. Afterwards the button must offer the other
    // theme, so the icon/label flip to the opposite one.
    const switchingTo = themeIcon.dataset.icon === 'theme-dark' ? 'dark' : 'light';
    const nextOfferTheme = switchingTo === 'dark' ? 'light' : 'dark';
    const nextOfferIcon = nextOfferTheme === 'dark' ? 'theme-dark' : 'theme-light';
    themeIcon.dataset.icon = nextOfferIcon;
    themeLabel.textContent = nextOfferTheme === 'dark' ? 'Dark' : 'Light';
    try {
      const res = await fetch(new URL(`${nextOfferIcon}.svg`, ICONS_BASE));
      themeIcon.innerHTML = await res.text();
    } catch (err) {
      // icons/ unreachable -- leave the previous icon in place
    }
    navBar.dispatchEvent(
      new CustomEvent('ds-nav-bar-theme-toggle', {
        bubbles: true,
        detail: { theme: switchingTo },
      })
    );
  });
});

})();
