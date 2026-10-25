/* zoom-buttons: a click on "+" or "-" dispatches `ds-zoom-step` (bubbles) from the
   group with detail.direction = 1 | -1. The host zooms whatever it wants and may
   disable a button at its limit (button.disabled). STAGED, see style.css.

   The click is caught once on the document, so a group drawn later (a bar below) works
   the same as one in the page's markup.

   DsZoomButtons.bar(root, { fitted, apply }) draws a preview's zoom bar into root and
   keeps its state, so every preview that uses it zooms the same way (explicit request
   2026-10-24): "Fit width" and the inline group; the current zoom is not written out
   (the maintainer, 2026-10-24), it is in the group's accessible name for screen readers.
   Fit (zoom null) is the default and the largest view: the page as wide as the preview,
   so "+" is off there (the maintainer, 2026-10-24). "-" steps down through the ZOOMS smaller than
   the fitted size to the smallest; "+" steps back up, and past the largest step under
   the fitted size it is fit again. "Fit width" goes straight back. The host only says
   how big a zoomed page may be (fitted(): its scale of the page's own size, the same
   whether it is zoomed now or not; fitOnPaper() gives it for a preview that leaves
   spacing-6 round zoomed pages, so a step never runs past that margin) and draws a
   zoom (apply(zoom): a scale of the page's own size, or null for fit).

   keep: { scroller, items } (optional, explicit request 2026-10-25): a zoom keeps the
   reader's place. The point of the document at the middle of the scroller (which of its
   items, the pages, and how far down it) stays at the middle after the zoom, so the same
   page is seen, only smaller or larger, instead of the scroll jumping elsewhere.
   scroller: the element that scrolls; items: a selector for the pages inside it. */
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('.ds-zoom-buttons__button') : null;
  const group = button && button.closest('.ds-zoom-buttons');
  if (!group || button.disabled) return;
  const direction = button.dataset.direction === 'in' ? 1 : -1;
  group.dispatchEvent(new CustomEvent('ds-zoom-step', { bubbles: true, detail: { direction } }));
});

window.DsZoomButtons = (function () {
  const ZOOMS = [0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5, 2];

  // Where the reader is: the item across the scroller's middle line, and how far down it.
  function mark(keep) {
    if (!keep || !keep.scroller) return null;
    const box = keep.scroller.getBoundingClientRect();
    const middle = box.top + keep.scroller.clientHeight / 2;
    let best = null;
    keep.scroller.querySelectorAll(keep.items).forEach((item) => {
      const r = item.getBoundingClientRect();
      const distance = middle < r.top ? r.top - middle : middle > r.bottom ? middle - r.bottom : 0;
      if (r.height && (!best || distance < best.distance)) best = { item, distance, r };
    });
    if (!best) return null;
    return { item: best.item, along: Math.min(1, Math.max(0, (middle - best.r.top) / best.r.height)), middle };
  }

  // After the zoom: scroll so that point is at the middle again.
  function restore(keep, place) {
    if (!place || !place.item.isConnected) return;
    const r = place.item.getBoundingClientRect();
    keep.scroller.scrollTop += r.top + place.along * r.height - place.middle;
  }

  function bar(root, { fitted, apply, label = 'Zoom preview', keep = null }) {
    const safeLabel = String(label).replace(/[&<>"]/g, '');
    root.classList.add('ds-zoom-buttons-bar');
    root.innerHTML = `
      <button type="button" class="ds-text-button" data-zoom-fit data-priority="secondary" data-underline="dotted"><span class="ds-text-button__text">Fit width</span></button>
      <div class="ds-zoom-buttons" data-inline role="group">
        <button type="button" class="ds-zoom-buttons__button" data-direction="out" aria-label="Zoom out"><span class="ds-zoom-buttons__icon" aria-hidden="true"></span></button>
        <button type="button" class="ds-zoom-buttons__button" data-direction="in" aria-label="Zoom in"><span class="ds-zoom-buttons__icon" aria-hidden="true"></span></button>
      </div>`;
    const fitButton = root.querySelector('[data-zoom-fit]');
    const group = root.querySelector('.ds-zoom-buttons');
    const [out, inn] = group.querySelectorAll('.ds-zoom-buttons__button');
    let zoom = null;   // null: fit

    // The steps under the fitted size, smallest first; fit sits above the last.
    const steps = () => {
      const now = fitted() || 1;
      return ZOOMS.filter((z) => z < now - 0.01);
    };

    let shown;   // the zoom drawn last; nothing to keep on the first draw
    function show() {
      const place = shown !== undefined && shown !== zoom ? mark(keep) : null;
      apply(zoom);
      shown = zoom;
      restore(keep, place);
      group.setAttribute('aria-label', `${safeLabel}, ${zoom === null ? 'fit width' : `${Math.round(zoom * 100)}%`}`);
      fitButton.disabled = zoom === null;
      fitButton.dataset.status = zoom === null ? 'disabled' : 'active';
      out.disabled = zoom === null ? steps().length === 0 : zoom <= ZOOMS[0];
      inn.disabled = zoom === null;
    }

    group.addEventListener('ds-zoom-step', (event) => {
      const below = steps();
      if (event.detail.direction < 0) {
        if (zoom === null) zoom = below.length ? below[below.length - 1] : null;
        else zoom = [...ZOOMS].reverse().find((z) => z < zoom - 0.001) || zoom;
      } else if (zoom !== null) {
        zoom = below.find((z) => z > zoom + 0.001) || null;
      }
      show();
    });
    fitButton.addEventListener('click', () => {
      zoom = null;
      show();
    });
    show();
    return { get zoom() { return zoom; } };
  }

  /** The largest scale at which a page pageWidth wide fits in container zoomed out, with
      the spacing-6 a zoomed preview leaves round its pages: what bar's fitted() wants.
      aside: room a centred page needs on each side besides that (a tool hung beside it). */
  function fitOnPaper(container, pageWidth, aside = 0) {
    const pad = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ds-spacing-6')) || 0;
    return Math.max(0, container.clientWidth - 2 * (pad + aside)) / pageWidth;
  }

  return { ZOOMS, bar, fitOnPaper };
}());
