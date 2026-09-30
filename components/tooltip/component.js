/*
  tooltip -- show/hide is pure CSS (:hover, :focus-visible) and the text
  comes straight from the trigger's own data-tooltip attribute via content:
  attr() in style.css. This file only keeps the bubble on screen
  (explicit request 2026-09-30, "make the tooltip adapt to the screen, and
  if it doesn't fit in height, end it with ..."), which CSS alone can't:
  the bubble's position depends on where its trigger sits in the viewport.

  On hover/focus of any [data-tooltip] element (one delegated listener on
  the document, so triggers added later -- or given data-tooltip at hover
  time by a host -- work too), it measures the trigger and the bubble and
  sets on the trigger:
    - --_tooltip-shift: a horizontal offset that keeps the bubble at least
      spacing-6 from either viewport edge (the same margin popup's anchored
      placement keeps, read from the token at runtime);
    - data-tooltip-placement="below" when the full bubble fits below but
      not above (default placement stays above);
    - data-tooltip-clamped: when it fits on neither side, the text cut at
      the last word that fits on the roomier side, plus an ellipsis;
      style.css shows that instead of data-tooltip.
  Runs one frame after the event, so a host listener on the same event
  (e.g. one that sets data-tooltip only once it sees the text is
  truncated) has already run.
*/

(function () {

const rootStyle = getComputedStyle(document.documentElement);
const token = (name, fallback) => parseFloat(rootStyle.getPropertyValue(name)) || fallback;
const VIEWPORT_MARGIN = token('--ds-spacing-6', 20);
const GAP = token('--ds-spacing-2', 4);

// The bubble's full border-box size, as currently rendered.
function measure(trigger) {
  const b = getComputedStyle(trigger, '::after');
  const px = (v) => parseFloat(v) || 0;
  return {
    width: px(b.width) + px(b.paddingLeft) + px(b.paddingRight) + px(b.borderLeftWidth) + px(b.borderRightWidth),
    height: px(b.height) + px(b.paddingTop) + px(b.paddingBottom) + px(b.borderTopWidth) + px(b.borderBottomWidth),
  };
}

// Longest word-boundary prefix of `text` (+ ellipsis) whose bubble is at
// most maxHeight tall — a binary search over the word count, re-measuring
// the real rendered bubble each step.
function clampText(trigger, text, maxHeight) {
  const words = text.split(/(\s+)/);
  let lo = 1;
  let hi = words.length;
  let best = `${words[0]}…`;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = `${words.slice(0, mid).join('').trimEnd()}…`;
    trigger.dataset.tooltipClamped = candidate;
    if (measure(trigger).height <= maxHeight) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  trigger.dataset.tooltipClamped = best;
}

function fit(trigger) {
  if (!trigger.isConnected || !trigger.dataset.tooltip) return;

  // Measure the unconstrained bubble first.
  trigger.style.removeProperty('--_tooltip-shift');
  delete trigger.dataset.tooltipPlacement;
  delete trigger.dataset.tooltipClamped;

  const rect = trigger.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  // Vertical: above if it fits, else below if it fits, else the roomier
  // side with the text cut to fit.
  const roomAbove = rect.top - GAP - VIEWPORT_MARGIN;
  const roomBelow = vh - rect.bottom - GAP - VIEWPORT_MARGIN;
  const { height } = measure(trigger);
  if (height > roomAbove) {
    if (height <= roomBelow || roomBelow > roomAbove) trigger.dataset.tooltipPlacement = 'below';
    if (height > Math.max(roomAbove, roomBelow)) {
      clampText(trigger, trigger.dataset.tooltip, Math.max(roomAbove, roomBelow));
    }
  }

  // Horizontal: keep inside [margin, vw - margin] (measured after any cut,
  // which can make the bubble narrower).
  const { width } = measure(trigger);
  const centeredLeft = rect.left + rect.width / 2 - width / 2;
  const clampedLeft = Math.max(VIEWPORT_MARGIN, Math.min(centeredLeft, vw - VIEWPORT_MARGIN - width));
  const shift = clampedLeft - centeredLeft;
  if (Math.abs(shift) >= 0.5) trigger.style.setProperty('--_tooltip-shift', `${shift}px`);
}

function onEnter(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  requestAnimationFrame(() => {
    const trigger = target.closest('[data-tooltip]');
    if (trigger) fit(trigger);
  });
}

document.addEventListener('mouseover', onEnter);
document.addEventListener('focusin', onEnter);

})();
