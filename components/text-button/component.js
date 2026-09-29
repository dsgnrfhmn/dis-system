/*
  text-button — status (active/loading/disabled/confirmed) is set by the host
  via the data-status attribute; this only dispatches a click event carrying
  the current priority/status so hosts/agents can hook in without this
  component knowing anything about its container.

  [data-icon]: loads the real vector glyph from icons/<name>.svg and inlines
  it -- same mechanism as nav-bar/table-cell/input-dropdown's own
  component.js (fetch + innerHTML, not <img>, so fill/stroke="currentColor"
  picks up this element's own `color`, i.e. the button's status color).
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

/*
  Wraps a plain button's bare text content in a real .ds-text-button__text
  span (bugfix, 2026-09-17, "the lines are still there" -- three CSS-only attempts
  on the descendant side, verified wrong via actual browser inspection:
  Chromium paints an ancestor's text-decoration-line across that
  ancestor's FULL content-box width as one continuous line, regardless of
  a descendant's own color/text-decoration-line/display -- there is no
  descendant-side CSS property that makes it stop under part of that
  width. The permanent underline was set on .ds-text-button itself, whose
  content box spans label + both bracket pseudo-elements, so the line
  (dotted, in this system) kept painting dots across the reserved-but-
  invisible bracket space no matter what those pseudo-elements' own
  properties said.
  Fix: give the underline its OWN, narrower decorating box -- move
  text-decoration off .ds-text-button entirely (see style.css) and onto
  this wrapper span instead, whose content-box width is exactly the label
  text, nothing more. Icon-variant buttons already carry a real
  .ds-text-button__label span (see index.html's icon-variant instances)
  and are left alone; this only wraps buttons that don't already have
  one -- plain bare-text buttons, the majority of usages across every
  consuming page, none of which need a markup change for this fix.
*/
document.querySelectorAll('.ds-text-button').forEach((button) => {
  if (button.querySelector(':scope > .ds-text-button__label, :scope > .ds-text-button__text')) return;
  // icon_only: the icon is the whole content; there is no text to wrap.
  if (button.dataset.iconOnly === 'true') return;
  const text = document.createElement('span');
  text.className = 'ds-text-button__text';
  while (button.firstChild) {
    text.appendChild(button.firstChild);
  }
  button.appendChild(text);
});

document.querySelectorAll('.ds-text-button__icon[data-icon]').forEach(async (el) => {
  try {
    const res = await fetch(new URL(`${el.dataset.icon}.svg`, ICONS_BASE));
    el.innerHTML = await res.text();
  } catch (err) {
    // icons/ unreachable (e.g. opened without a server) -- leave empty
  }
});

document.querySelectorAll('.ds-text-button').forEach((button) => {
  button.addEventListener('click', () => {
    button.dispatchEvent(
      new CustomEvent('ds-text-button-click', {
        bubbles: true,
        detail: {
          priority: button.dataset.priority,
          status: button.dataset.status,
        },
      })
    );
  });
});

})();
