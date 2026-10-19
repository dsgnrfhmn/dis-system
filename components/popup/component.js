/*
  popup -- open/close wiring for `.ds-popup-overlay[id]`.

  Penpot's own source models no open/closed state at all (every sampled
  instance is the permanently-open panel, there is no hidden variant) and
  no close/X control. This file supersedes this component's earlier "no
  behavior of its own" stance, per an explicit host request to preview
  each modal type opening over a real overlay -- the same functional-gap
  category as dropdown-menu's own open/close wiring (reused pattern:
  hidden toggling, outside/backdrop click, Escape), not invented
  decoration.

  Contract:
    <button data-popup-open="some-id">Open</button>
    <div class="ds-popup-overlay" id="some-id" hidden>
      <div class="ds-popup" tabindex="-1">
        ...
        <button data-popup-dismiss>Close</button>
      </div>
    </div>

  Dismissal: any element inside the overlay carrying [data-popup-dismiss]
  closes it (the bottom row's own secondary/cancel AND primary/confirm
  buttons -- submitting closes the dialog too, same as Cancel), plus a
  click on the backdrop itself (not the panel), Escape, and now
  Ctrl+Enter/Cmd+Enter (clicks the bottom row's own primary button, per
  the consumer spec -- not from Penpot, ADDED 2026-09-09,
  same functional-gap category as the rest of this file). Focus moves
  onto the panel on open (tabindex="-1", see index.html) and returns to
  whichever trigger opened it on close. Tab / Shift+Tab are trapped in the
  topmost open popup (explicit request 2026-10-03, closing the gap this
  comment used to note): from its last focusable control Tab wraps to the
  first, Shift+Tab from the first (or from the panel itself) wraps to the
  last, and focus that has somehow left the popup is pulled back in.

  Overlay stacking (A10c, added 2026-09-09, not from Penpot -- a static
  design tool has no notion of one dialog opening from inside another):
  a popup opened while another is already open (e.g. Collection's
 confirmations, triggered from inside the Add/Edit project form
  popup) gets a higher z-index than every currently-open overlay, and
  Escape/backdrop-click only ever act on the topmost one -- a single
  shared stack (openOverlays below), not per-overlay independent
  listeners, is what makes "topmost only" possible: with each overlay
  listening independently (the previous version of this file), two open
  overlays would BOTH close on one Escape press, which is wrong.

  Static backdrop (requested 2026-10-13, Add project popup): an overlay carrying
  data-backdrop="static" ignores a click on the backdrop and Escape; only its
  own [data-popup-dismiss] buttons (and Ctrl+Enter's confirm) close it. Opt-in,
  per overlay: every other popup keeps closing on a click outside and Escape.

  Close request (requested 2026-10-13, Add project popup): a dismissal the user
  starts (a [data-popup-dismiss] button, the backdrop, Escape) first dispatches a
  cancelable ds-popup-before-close on the overlay (bubbles; detail: { source:
  "button" | "backdrop" | "escape", button }). A host that calls preventDefault()
  keeps the popup open, e.g. to ask "discard the changes?" first; the same click
  then reaches the document, so a data-popup-open set on the button during the
  event opens that confirmation anchored to it. Without a listener nothing changes.

  Since 2026-10-13 placement="anchored" no longer anchors: confirmations open
  centered over the 50% backdrop like every popup (positionAnchored below is kept,
  unused, until a consumer asks for anchoring again). The text that follows
  describes what it used to do.

  Anchored placement (A10b, added 2026-09-09, not from Penpot): when the
  overlay carries data-placement="anchored" (the consumer spec's
   Confirmation kind, "anchored near the triggering button,
  clamped to viewport"), the panel is positioned via inline style next to
  whichever trigger opened it, rather than centered over a dimmed
  backdrop -- style.css disables the centering/backdrop for this
  placement, and positionAnchored() below does the actual math, reusing
  dropdown-menu's own real gap value (spacing-3, read from CSS at
  runtime rather than hardcoded) as the trigger-to-panel offset, same
  precedent that component's own meta.json already documents. The
  overlay itself stays a full-viewport, invisible click-catching layer
  (dimmed lightly since 2026-09-18, see style.css) so "click outside the panel closes it" keeps working
  unchanged from the centered case.
*/

/*
  Anchored geometry (2026-09-18, Figma's confirmation screens): the panel sits
  10px under its trigger and never closer than 20px to a viewport edge -- so
  a confirmation opened from the right-docked header actions lines its right
  edge up with the page's 20px margin. Both are read from the spacing tokens
  at runtime rather than hardcoded, so they cannot drift from them: 10px is
  spacing-3 + spacing-1, 20px is spacing-6. (It was spacing-3, 8px, for both.)
  The panel's height is capped to the viewport too, and its body scrolls
  (style.css), so a long confirmation can never push its buttons off screen.
*/
const rootStyle = getComputedStyle(document.documentElement);
const token = (name, fallback) => parseFloat(rootStyle.getPropertyValue(name)) || fallback;
const ANCHOR_GAP = token('--ds-spacing-3', 8) + token('--ds-spacing-1', 2);
const VIEWPORT_MARGIN = token('--ds-spacing-6', 20);

function positionAnchored(overlay, trigger) {
  const panel = overlay.querySelector(':scope > .ds-popup');
  if (!panel || !trigger) return;
  panel.style.position = 'fixed';

  const triggerRect = trigger.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  // Cap the height first, so the fit test below sees the size the panel will
  // really have. clientWidth/Height, not innerWidth/Height, which include the
  // scrollbar gutter and would let the panel sit past the visible edge.
  panel.style.maxHeight = `${vh - 2 * VIEWPORT_MARGIN}px`;
  const panelRect = panel.getBoundingClientRect();

  let top = triggerRect.bottom + ANCHOR_GAP;
  if (top + panelRect.height > vh - VIEWPORT_MARGIN) {
    // No room below -- flip above the trigger; if that does not fit either,
    // pin the panel inside the bottom margin.
    const above = triggerRect.top - panelRect.height - ANCHOR_GAP;
    top = above >= VIEWPORT_MARGIN
      ? above
      : Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - panelRect.height);
  }

  let left = triggerRect.left;
  left = Math.min(left, vw - panelRect.width - VIEWPORT_MARGIN);
  left = Math.max(VIEWPORT_MARGIN, left);

  panel.style.top = `${top}px`;
  panel.style.left = `${left}px`;
}

const openOverlays = [];
const BASE_Z_INDEX = 100;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function trapTab(event, overlay) {
  const focusable = Array.from(overlay.querySelectorAll(FOCUSABLE)).filter(
    (el) => !el.closest('[hidden]') && el.getClientRects().length > 0
  );
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const inside = overlay.contains(active);
  if (event.shiftKey && (!inside || active === first || !focusable.includes(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || active === last)) {
    event.preventDefault();
    first.focus();
  }
}

function onDocumentKeydown(event) {
  const topmost = openOverlays[openOverlays.length - 1];
  if (!topmost) return;
  if (event.key === 'Escape') {
    if (topmost.overlay.dataset.backdrop !== 'static') topmost.request('escape');
  } else if (event.key === 'Tab') {
    trapTab(event, topmost.overlay);
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    // The action marked data-popup-confirm; else a priority="primary" one
    // (Figma draws every popup action the same weight, so a consumer that
    // wants Ctrl+Enter to work marks the confirming one explicitly).
    const primary = topmost.overlay.querySelector('.ds-popup__bottom [data-popup-confirm]')
      || topmost.overlay.querySelector('.ds-popup__bottom .ds-text-button[data-priority="primary"]');
    if (primary) primary.click();
  }
}
document.addEventListener('keydown', onDocumentKeydown);

// Scroll lock (explicit request 2026-10-11): while any overlay is open the page behind
// it does not scroll, the wheel and touch scroll only the popup's own body. One
// attribute on <html>, set while the stack is not empty; style.css does the rest.
// The width the native scrollbar takes away is put back as padding, so the page does
// not shift sideways (0 when the host hides its scrollbar).
function syncScrollLock() {
  const root = document.documentElement;
  if (openOverlays.length === 0) {
    delete root.dataset.popupScrollLock;
    root.style.removeProperty('--_popup-scrollbar-width');
    return;
  }
  if (root.dataset.popupScrollLock === undefined) {
    const gutter = window.innerWidth - root.clientWidth;
    root.style.setProperty('--_popup-scrollbar-width', `${Math.max(gutter, 0)}px`);
    root.dataset.popupScrollLock = '';
  }
}

function initPopup(overlay) {
  let opener = null;

  function open(trigger) {
    opener = trigger || null;
    overlay.hidden = false;
    overlay.style.zIndex = String(BASE_Z_INDEX + openOverlays.length * 10);
    openOverlays.push({ overlay, close, request });
    syncScrollLock();
    // Confirmations (placement="anchored") are centered like every other popup since
    // 2026-10-13 (maintainer): the panel is no longer placed next to its trigger.
    const panel = overlay.querySelector(':scope > .ds-popup');
    if (panel) panel.focus();
  }

  // A user-started dismissal: the host may veto it (see "Close request" above).
  function request(source, button) {
    const event = new CustomEvent('ds-popup-before-close', {
      bubbles: true, cancelable: true, detail: { source, button: button || null },
    });
    if (overlay.dispatchEvent(event)) close();
  }

  function close() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    const index = openOverlays.findIndex((entry) => entry.overlay === overlay);
    if (index !== -1) openOverlays.splice(index, 1);
    syncScrollLock();
    if (opener) opener.focus();
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      if (overlay.dataset.backdrop !== 'static') request('backdrop');
      return;
    }
    // Delegated (not a one-time querySelectorAll('[data-popup-dismiss]')
    // forEach): a popup's own body content can be replaced/extended at
    // runtime by the consuming page (the consumer spec's Prepare Submission row,
    // any confirmation whose button set isn't known until the page wires
    // it) -- a dismiss button added after this overlay was first scanned
    // needs to work exactly like one that was always there. Found while
    // wiring the consuming app's own For You page (2026-09-10).
    const dismiss = event.target.closest('[data-popup-dismiss]');
    if (dismiss) request('button', dismiss);
  });

  return { open, close };
}

const popups = new Map();
document.querySelectorAll('.ds-popup-overlay[id]').forEach((overlay) => {
  popups.set(overlay.id, initPopup(overlay));
});

// Delegated for the same reason as the dismiss handling above: a trigger
// button created after page load (e.g. an action-group swapped in by
// the consuming app's own JS) still needs data-popup-open to work without the
// consuming page having to re-wire anything itself.
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-popup-open]');
  if (!trigger) return;
  const popup = popups.get(trigger.dataset.popupOpen);
  if (popup) popup.open(trigger);
});
