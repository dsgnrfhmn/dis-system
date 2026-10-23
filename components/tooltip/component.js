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

/*
  Layer mode (2026-10-23): opt-in with data-tooltip-mode="layer" on <html> or
  <body>. The trigger's own ::after bubble is off (style.css) and one fixed
  element in <body> shows the text instead, over the trigger's box, after
  data-tooltip-delay ms (default 500) -- so no overflow ancestor (a scrolling
  table, a clamped cell) cuts the bubble and no sticky bar covers it, and
  tooltips on a dense page do not flash while the pointer crosses it. The
  layer is the same [data-tooltip] bubble, so placement and the shift above
  apply unchanged. A trigger is an element with data-tooltip, or a
  text-button / header-tab / sort button whose label carries it (text-button
  draws its brackets with its own ::before/::after). Scroll, click, a key or
  a resize hides it.
*/
const modeHost = [document.documentElement, document.body].find((el) => el && el.dataset.tooltipMode === 'layer');

if (!modeHost) {
  document.addEventListener('mouseover', onEnter);
  document.addEventListener('focusin', onEnter);
} else {
  const delay = parseInt(modeHost.dataset.tooltipDelay, 10);
  const DELAY = Number.isFinite(delay) && delay >= 0 ? delay : 500;
  const layer = document.createElement('span');
  layer.className = 'ds-tooltip-layer';
  layer.hidden = true;
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  let timer = 0;
  let current = null;

  const triggerOf = (node) => {
    if (!(node instanceof Element)) return null;
    const own = node.closest('[data-tooltip]:not(.ds-tooltip-layer)');
    const host = node.closest('.ds-text-button, .ds-header-tab, .ds-table-header-cell__sort-btn');
    // A wrapper's tooltip wins over a button inside it; a label's tooltip shows for its whole button.
    if (own && !(host && own !== host && host.contains(own))) return { box: own, text: own.getAttribute('data-tooltip') };
    if (!host) return null;
    const label = host.querySelector('[data-tooltip]');
    return label ? { box: host, text: label.getAttribute('data-tooltip') } : null;
  };
  const hide = () => {
    clearTimeout(timer);
    current = null;
    layer.hidden = true;
  };
  const show = (t) => {
    const r = t.box.getBoundingClientRect();
    Object.assign(layer.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    layer.setAttribute('data-tooltip', t.text);
    layer.hidden = false;
    fit(layer);
  };
  const enter = (event) => {
    const t = triggerOf(event.target);
    if (!t || !t.text) return;
    if (current && current.external) hide();
    if (current && current.box === t.box) return;
    hide();
    current = t;
    timer = setTimeout(() => { if (current === t && t.box.isConnected) show(t); }, DELAY);
  };
  const leave = (event) => {
    if (current && current.external) return;
    if (current && !(event.relatedTarget instanceof Element && current.box.contains(event.relatedTarget))) hide();
  };
  document.addEventListener('mouseover', enter);
  document.addEventListener('mouseout', leave);
  document.addEventListener('focusin', enter);
  document.addEventListener('focusout', hide);
  ['scroll', 'click', 'keydown', 'resize'].forEach((type) => window.addEventListener(type, hide, true));

  /* window.dsTooltip (2026-10-23): a host shows its own text on the same
     layer for something that is not an element with data-tooltip -- a word
     inside a text, at a range's box. show({ getBoundingClientRect }, text)
     shows it at once (the host keeps its own delay); hide() hides whatever
     is shown; isTrigger(element) says whether the element (or a control
     around it) has a tooltip of its own, so the host leaves it alone. A
     shown host tooltip is not hidden by mouseout, only by the host, by
     another tooltip or by scroll / click / key / resize. text is plain text
     (it becomes the data-tooltip attribute). */
  window.dsTooltip = {
    show(box, text) {
      if (!box || !text) return;
      hide();
      current = { box, text, external: true };
      show(current);
    },
    hide,
    isTrigger: (element) => !!triggerOf(element),
    delay: DELAY,
  };
}

})();
