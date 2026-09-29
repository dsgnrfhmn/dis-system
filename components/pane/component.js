/*
  pane

  Only for a resizable container: any flex row with `data-resizable` that holds
  two neighbours and a `.ds-split__handle` between them (a `.ds-split` of two
  panes, or a page shell of a sidebar and its main column). Everything else in
  this component is CSS.

  data-resize-target="end" (default) resizes the element after the handle and
  dragging left widens it; "start" resizes the element before it and dragging
  right widens it. The other side takes the rest. Limits, in pixels:
  data-min-size for the resized element (default 320) and data-min-rest for the
  rest (default 320), so neither side is squeezed. Until the first drag nothing
  is set and the layout is whatever the CSS says. Once resized the element gets
  data-resized and --_resize-size (the CSS in style.css and in sidebar-list
  turns that into a width), so a state the CSS owns, such as a collapsed
  sidebar, still wins.

  Arrow keys on the handle move it in 24px steps (left/right widen the "end" /
  "start" target respectively). A collapsed target (data-collapsed="true") does
  not resize.

  Remembered: with data-resize-key="name" the target's share of the container's
  width is kept in localStorage ("ds-split:name") and applied on load. It is a
  share, not pixels, so a different window width keeps the same proportion.
  Storage can be missing or throw (private window, blocked site data): the layout
  then starts as the CSS has it and nothing else changes.

  Events: `ds-split-resize` on the container (bubbles, detail.size in px) while
  dragging. A `resize` event is also sent to window, because components that
  measure themselves against their pane (paper-preview's scroll thumb, a nested
  resizable container keeping its own proportion) listen for that one.
*/
(function () {
  const KEY_STEP = 24;

  function load(key) {
    if (!key) return null;
    try {
      const value = parseFloat(window.localStorage.getItem(`ds-split:${key}`));
      return value > 0 && value < 1 ? value : null;
    } catch (error) {
      return null;
    }
  }

  function save(key, share) {
    if (!key) return;
    try {
      window.localStorage.setItem(`ds-split:${key}`, String(share));
    } catch (error) {
      // not remembered, the split still works
    }
  }

  function initSplit(split) {
    const handle = split.querySelector(':scope > .ds-split__handle');
    if (!handle || !handle.previousElementSibling || !handle.nextElementSibling) return;
    // dir: which way the pointer moves to widen the target (+1 right, -1 left).
    const dir = split.dataset.resizeTarget === 'start' ? 1 : -1;
    const target = dir === 1 ? handle.previousElementSibling : handle.nextElementSibling;
    const minSize = parseInt(split.dataset.minSize || '320', 10);
    const minRest = parseInt(split.dataset.minRest || '320', 10);
    const key = split.dataset.resizeKey;
    let share = load(key);

    const total = () => split.getBoundingClientRect().width;
    // A container narrower than both minimums gives the target half.
    const clamp = (px) => {
      const room = total();
      if (room < minSize + minRest) return room / 2;
      return Math.min(room - minRest, Math.max(minSize, px));
    };
    const width = () => target.getBoundingClientRect().width;

    const percent = (px) => String(Math.round((px / total()) * 100));
    function apply(px) {
      const size = clamp(px);
      target.dataset.resized = '';
      target.style.setProperty('--_resize-size', `${size}px`);
      handle.setAttribute('aria-valuenow', percent(size));
      handle.setAttribute('aria-valuemin', percent(Math.min(minSize, total() / 2)));
      handle.setAttribute('aria-valuemax', percent(total() - Math.min(minRest, total() / 2)));
      return size;
    }

    function resized(size) {
      share = size / total();
      split.dispatchEvent(new CustomEvent('ds-split-resize', { bubbles: true, detail: { size } }));
      window.dispatchEvent(new Event('resize'));
    }

    if (share !== null) apply(share * total());
    else {
      handle.setAttribute('aria-valuenow', percent(width()));
      handle.setAttribute('aria-valuemin', percent(Math.min(minSize, total() / 2)));
      handle.setAttribute('aria-valuemax', percent(total() - Math.min(minRest, total() / 2)));
    }
    const collapsed = () => target.dataset.collapsed === 'true';

    let drag = null;
    let frame = 0;
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || collapsed()) return;
      drag = { x: event.clientX, width: width() };
      handle.setPointerCapture(event.pointerId);
      split.dataset.dragging = 'true';
      event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const size = apply(drag.width + dir * (event.clientX - drag.x));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => resized(size));
    });
    const finish = () => {
      if (!drag) return;
      drag = null;
      delete split.dataset.dragging;
      save(key, share);
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);

    handle.addEventListener('keydown', (event) => {
      const grow = { ArrowLeft: -dir * KEY_STEP, ArrowRight: dir * KEY_STEP }[event.key];
      if (grow === undefined || collapsed()) return;
      event.preventDefault();
      resized(apply(width() + grow));
      save(key, share);
    });

    // A different window width keeps the proportion the user chose.
    window.addEventListener('resize', () => {
      if (share !== null && !drag) apply(share * total());
    });
  }

  document.querySelectorAll('[data-resizable]').forEach(initSplit);
})();
