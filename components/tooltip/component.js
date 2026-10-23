/*
  tooltip -- one shared bubble (.ds-tooltip-layer) shown for whichever
  [data-tooltip] element the pointer or keyboard focus is on. The text comes
  from that element's own data-tooltip attribute.

  Why one element in the top layer (explicit request 2026-10-20, "tooltips
  always above any content"): the earlier bubble was the trigger's own
  ::after, so it lived inside the trigger's stacking context and was cut off
  by anything that clipped or out-stacked an ancestor (a table cell's
  overflow, a sticky header, the hero block). The shared bubble is a manual
  popover (popover="manual", showPopover()), which the browser paints in the
  top layer above every z-index, overflow and stacking context on the page,
  popups included. It is positioned with position: fixed from the trigger's
  rect.

  Show: one second after hover or keyboard focus (explicit request
  2026-10-14: a tooltip that appears at once flashes over every control the
  pointer passes); data-tooltip-instant on the trigger skips the delay.
  Hide: at once, when the pointer or focus leaves the trigger, on scroll,
  resize, Escape, or when the trigger is removed from the page.

  Fit (explicit request 2026-09-30, "make the tooltip adapt to the screen, and
  if it doesn't fit in height, end it with ..."): the bubble sits above the
  trigger, flips below when it only fits there, is kept at least spacing-6
  from the viewport edges, and when it fits on neither side its text is cut at
  the last word that fits, plus an ellipsis.

  A native <button disabled> still gets mouseover in current browsers, so a
  tooltip on a disabled button works with the pointer; it is not
  keyboard-reachable (a disabled button takes no focus).
*/

(function () {

const rootStyle = getComputedStyle(document.documentElement);
const token = (name, fallback) => parseFloat(rootStyle.getPropertyValue(name)) || fallback;
const VIEWPORT_MARGIN = token('--ds-spacing-6', 20);
const GAP = token('--ds-spacing-2', 4);
const SHOW_DELAY = 1000;

let layer = null;
let current = null;   // the trigger the bubble belongs to (shown or waiting)
let timer = 0;
let watch = 0;

function getLayer() {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'ds-tooltip-layer';
  layer.setAttribute('role', 'tooltip');
  layer.setAttribute('popover', 'manual');
  document.body.appendChild(layer);
  return layer;
}

// A text button's bubble is centered on its label, not on the padding and
// hover-bracket space around it.
function anchorOf(trigger) {
  if (!trigger.classList.contains('ds-text-button')) return trigger;
  return trigger.querySelector(':scope > .ds-text-button__text, :scope > .ds-text-button__label') || trigger;
}

function bubbleHeight(el) {
  return el.getBoundingClientRect().height;
}

// Longest word-boundary prefix of `text` (+ ellipsis) whose bubble is at most
// maxHeight tall: a binary search over the word count, re-measuring the real
// rendered bubble each step.
function clampText(el, text, maxHeight) {
  const words = text.split(/(\s+)/);
  let lo = 1;
  let hi = words.length;
  let best = `${words[0]}…`;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = `${words.slice(0, mid).join('').trimEnd()}…`;
    el.textContent = candidate;
    if (bubbleHeight(el) <= maxHeight) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  el.textContent = best;
}

function place(trigger, text) {
  const el = getLayer();
  el.textContent = text;
  el.style.left = '0px';
  el.style.top = '0px';
  if (!el.matches(':popover-open')) el.showPopover();

  const rect = anchorOf(trigger).getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  // Vertical: above if it fits, else below if it fits, else the roomier side
  // with the text cut to fit.
  const roomAbove = rect.top - GAP - VIEWPORT_MARGIN;
  const roomBelow = vh - rect.bottom - GAP - VIEWPORT_MARGIN;
  let height = bubbleHeight(el);
  let below = false;
  if (height > roomAbove) {
    below = height <= roomBelow || roomBelow > roomAbove;
    if (height > Math.max(roomAbove, roomBelow)) {
      clampText(el, text, Math.max(roomAbove, roomBelow));
      height = bubbleHeight(el);
    }
  }

  // Horizontal: centered on the trigger, kept inside [margin, vw - margin].
  const { width } = el.getBoundingClientRect();
  const centered = rect.left + rect.width / 2 - width / 2;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(centered, vw - VIEWPORT_MARGIN - width));
  const top = below ? rect.bottom + GAP : rect.top - GAP - height;

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.dataset.visible = 'true';
}

function hide() {
  clearTimeout(timer);
  clearInterval(watch);
  current = null;
  if (!layer) return;
  delete layer.dataset.visible;
  if (layer.matches(':popover-open')) layer.hidePopover();
}

function show(trigger) {
  const text = trigger.dataset.tooltip;
  if (!text || !trigger.isConnected) return hide();
  place(trigger, text);
}

function schedule(trigger) {
  if (trigger === current) return;
  hide();
  if (!trigger.dataset.tooltip) return;
  current = trigger;
  // Polled while waiting or shown: a trigger a host re-renders away would
  // otherwise leave its bubble behind with nothing left to fire mouseout.
  watch = setInterval(() => {
    if (!current || !current.isConnected) hide();
  }, 250);
  const wait = 'tooltipInstant' in trigger.dataset ? 0 : SHOW_DELAY;
  // Even the instant one runs a frame later, so a host listener on the same
  // event (one that sets data-tooltip only once it sees the text is
  // truncated) has already run.
  timer = setTimeout(() => requestAnimationFrame(() => current === trigger && show(trigger)), wait);
}

document.addEventListener('mouseover', (event) => {
  if (!(event.target instanceof Element)) return;
  const trigger = event.target.closest('[data-tooltip]');
  if (trigger) schedule(trigger);
  else if (current) hide();
});

document.addEventListener('mouseout', (event) => {
  if (!current) return;
  const to = event.relatedTarget;
  if (!(to instanceof Element) || !current.contains(to)) {
    // Moving onto another trigger is handled by its own mouseover.
    if (!(to instanceof Element) || !to.closest('[data-tooltip]')) hide();
  }
});

// Keyboard focus only (a mouse click that focuses a control shows nothing
// extra): focus on a control inside a trigger counts, as a tooltip on a table
// cell around a button.
document.addEventListener('focusin', (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.matches(':focus-visible')) return;
  const trigger = target.closest('[data-tooltip]');
  if (trigger) schedule(trigger);
});
document.addEventListener('focusout', () => hide());

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') hide();
});
window.addEventListener('scroll', hide, true);
window.addEventListener('resize', hide);

})();
