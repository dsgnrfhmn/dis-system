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

  Left (explicit request 2026-10-24, a column of icon buttons at a page's right):
  data-tooltip-placement="left" on the trigger puts the bubble at its left,
  centred on its height, kept inside the viewport's height; with no room on
  the left it falls back to the above / below placement.

  A native <button disabled> still gets mouseover in current browsers, so a
  tooltip on a disabled button works with the pointer; it is not
  keyboard-reachable (a disabled button takes no focus).

  Labels (2026-10-23): a text-button, header-tab or sort button whose label
  carries data-tooltip shows it for the whole button, not only over the
  label. A wrapper's own data-tooltip wins over a button inside it.

  Delay: data-tooltip-delay="<ms>" on <html> or <body> sets the show delay
  for the page; unset, it is one second. data-tooltip-mode="layer" there is
  accepted and changes nothing: since 2026-10-20 every tooltip is the layer.

  window.dsTooltip (2026-10-23): a host shows its own text on the same layer
  for something that is not an element with data-tooltip -- a word inside a
  text, at a range's box. show({ getBoundingClientRect }, text) shows it at
  once (the host keeps its own delay); hide() hides whatever is shown;
  isTrigger(element) says whether the element (or a control around it) has a
  tooltip of its own, so the host leaves it alone; delay is the page's show
  delay. A host tooltip is not hidden by the pointer leaving, only by the
  host, by another tooltip, or by scroll, resize, a click or a key. text is
  plain text.
*/

(function () {

const rootStyle = getComputedStyle(document.documentElement);
const token = (name, fallback) => parseFloat(rootStyle.getPropertyValue(name)) || fallback;
const VIEWPORT_MARGIN = token('--ds-spacing-6', 20);
const GAP = token('--ds-spacing-2', 4);
const delayHost = [document.documentElement, document.body].find((el) => el && el.dataset.tooltipDelay !== undefined);
const pageDelay = delayHost ? parseInt(delayHost.dataset.tooltipDelay, 10) : NaN;
const SHOW_DELAY = Number.isFinite(pageDelay) && pageDelay >= 0 ? pageDelay : 1000;

let layer = null;
// What the bubble belongs to, shown or waiting: { box, source } for a trigger
// (box is where the bubble sits, source carries data-tooltip), or
// { box, text, external: true } for a host's own text.
let current = null;
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
// hover-bracket space around it. A host's box is used as it is.
function anchorOf(box) {
  if (!(box instanceof Element) || !box.classList.contains('ds-text-button')) return box;
  return box.querySelector(':scope > .ds-text-button__text, :scope > .ds-text-button__label') || box;
}

const HOSTS = '.ds-text-button, .ds-header-tab, .ds-table-header-cell__sort-btn';

// The trigger for a node under the pointer or focus: its own [data-tooltip]
// ancestor, or a button whose label carries one. null when there is none.
function triggerOf(node) {
  if (!(node instanceof Element)) return null;
  const own = node.closest('[data-tooltip]');
  const host = node.closest(HOSTS);
  if (own && !(host && own !== host && host.contains(own))) return { box: own, source: own };
  if (!host) return null;
  const label = host.querySelector('[data-tooltip]');
  return label ? { box: host, source: label } : null;
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

function place(box, text, placement) {
  const el = getLayer();
  el.textContent = text;
  el.style.left = '0px';
  el.style.top = '0px';
  if (!el.matches(':popover-open')) el.showPopover();

  const rect = anchorOf(box).getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  if (placement === 'left') {
    const { width, height } = el.getBoundingClientRect();
    const left = rect.left - GAP - width;
    if (left >= VIEWPORT_MARGIN) {
      const centred = rect.top + rect.height / 2 - height / 2;
      el.style.left = `${left}px`;
      el.style.top = `${Math.max(VIEWPORT_MARGIN, Math.min(centred, vh - VIEWPORT_MARGIN - height))}px`;
      el.dataset.visible = 'true';
      return;
    }
  }

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

function show(t) {
  const text = t.source.getAttribute('data-tooltip');
  if (!text || !t.box.isConnected || !t.source.isConnected) return hide();
  place(t.box, text, t.source.getAttribute('data-tooltip-placement'));
}

function schedule(t) {
  if (current && !current.external && current.box === t.box && current.source === t.source) return;
  hide();
  if (!t.source.getAttribute('data-tooltip')) return;
  current = t;
  // Polled while waiting or shown: a trigger a host re-renders away would
  // otherwise leave its bubble behind with nothing left to fire mouseout.
  watch = setInterval(() => {
    if (!current || (!current.external && (!current.box.isConnected || !current.source.isConnected))) hide();
  }, 250);
  const wait = 'tooltipInstant' in t.source.dataset ? 0 : SHOW_DELAY;
  // Even the instant one runs a frame later, so a host listener on the same
  // event (one that sets data-tooltip only once it sees the text is
  // truncated) has already run.
  timer = setTimeout(() => requestAnimationFrame(() => current === t && show(t)), wait);
}

document.addEventListener('mouseover', (event) => {
  const t = triggerOf(event.target);
  if (t) schedule(t);
  else if (current && !current.external) hide();
});

document.addEventListener('mouseout', (event) => {
  if (!current || current.external) return;
  const to = event.relatedTarget;
  if (!(to instanceof Element) || !current.box.contains(to)) {
    // Moving onto another trigger is handled by its own mouseover.
    if (!triggerOf(to)) hide();
  }
});

// Keyboard focus only (a mouse click that focuses a control shows nothing
// extra): focus on a control inside a trigger counts, as a tooltip on a table
// cell around a button.
document.addEventListener('focusin', (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.matches(':focus-visible')) return;
  const t = triggerOf(target);
  if (t) schedule(t);
});
document.addEventListener('focusout', () => {
  if (current && !current.external) hide();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' || (current && current.external)) hide();
});
document.addEventListener('click', () => {
  if (current && current.external) hide();
}, true);
window.addEventListener('scroll', hide, true);
window.addEventListener('resize', hide);

window.dsTooltip = {
  show(box, text) {
    if (!box || !text) return;
    hide();
    current = { box, text, external: true };
    place(box, text);
  },
  hide,
  isTrigger: (element) => !!triggerOf(element),
  delay: SHOW_DELAY,
};

})();
