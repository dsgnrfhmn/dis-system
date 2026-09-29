/*
  gallery

  Multi-select behavior: clicking a .ds-gallery-image toggles its
  selection. The badge a selected image shows is its SELECTION ORDER (1st
  click = "1", 2nd click = "2", ...), not its position in the row -- that
  ordering is the entire point of a multi-select photo picker (this
  component's own description), the same functional-gap category as
  table-row's click-to-select checkbox and nav-bar's link click-swap:
  Penpot's static data can't model it, but it's a real gap, not invented
  decoration. Clicking an already-selected image deselects it; every image
  selected after it is renumbered down by one so the remaining sequence
  stays contiguous (1..N) -- matching how a native Photos app's own
  selection-order badges behave.

  Persistence: the ordered list of selected images' data-image-id is
  written to localStorage (key `ds-gallery-selection:<gallery id or DOM
  index>`) on every change, and restored on load -- host requirement so an
  external process (a Python script) can read which images are selected
  and in what order. This is genuinely host-application state, the same
  category table-row's own data-selected flag already is, not something
  Penpot's static design data defines.

  Drag-to-scroll + interactive scrollbar (both explicit, later host
  requests -- see each section's own comment below): dragging the row
  itself, or the scrollbar thumb, or clicking its track, all scroll
  .ds-gallery. All three share one wrapper block per gallery so drag
  state on the row can suppress a click-to-select it didn't mean to
  trigger (see the row-drag section).

  External reset trigger (see the ds-gallery-reset listener right after
  `toggle`, and the generic [data-gallery-reset] wiring at the bottom of
  this file): lets a button living in a different component entirely
  (e.g. popup's own "Reset selection") clear this gallery's selection
  without either component reaching into the other's internals.
*/

document.querySelectorAll('.ds-gallery-wrapper').forEach((wrapper, wrapperIndex) => {
  const track = wrapper.querySelector(':scope > .ds-gallery');
  if (!track) return;
  const images = Array.from(track.querySelectorAll(':scope > .ds-gallery-image'));

  // ---- selection --------------------------------------------------------
  const storageKey = `ds-gallery-selection:${track.id || wrapperIndex}`;

  const readSelection = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  };

  const writeSelection = (order) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(order));
    } catch (err) {
      // localStorage unavailable (private mode, quota) -- selection still
      // works for this page load, it just won't persist across reloads
    }
  };

  const render = (order) => {
    images.forEach((img) => {
      const position = order.indexOf(img.dataset.imageId);
      const selected = position !== -1;
      img.setAttribute('data-selected', String(selected));
      img.setAttribute('aria-pressed', String(selected));

      let badge = img.querySelector(':scope > .ds-gallery-image__badge');
      if (selected) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'ds-gallery-image__badge';
          img.appendChild(badge);
        }
        badge.textContent = String(position + 1);
      } else if (badge) {
        badge.remove();
      }
    });
  };

  // Drop any stored ids that no longer match an image in this gallery
  // (e.g. the demo markup changed) rather than rendering a stale/broken
  // selection.
  let order = readSelection().filter((id) => images.some((img) => img.dataset.imageId === id));
  render(order);

  const toggle = (img) => {
    const id = img.dataset.imageId;
    const position = order.indexOf(id);
    order = position === -1 ? [...order, id] : order.filter((existing) => existing !== id);
    writeSelection(order);
    render(order);
    track.dispatchEvent(new CustomEvent('ds-gallery-select', {
      bubbles: true,
      detail: { order: [...order] },
    }));
  };

  // Reset: clears every selection at once (all badges removed, order
  // emptied) -- explicit host request for an external "Reset selection"
  // control (see popup's own gallery-type body). Reuses the exact same
  // write/render/dispatch steps toggle() already does per-image, just with
  // an empty order, so there's one source of truth for what "selection
  // changed" means, not a second parallel implementation. Triggered by a
  // `ds-gallery-reset` event dispatched at this track -- see the generic
  // [data-gallery-reset] wiring at the bottom of this file, which is how
  // an external button (in a different component entirely) reaches it
  // without either component reaching into the other's internals.
  track.addEventListener('ds-gallery-reset', () => {
    if (!order.length) return;
    order = [];
    writeSelection(order);
    render(order);
    track.dispatchEvent(new CustomEvent('ds-gallery-select', {
      bubbles: true,
      detail: { order: [] },
    }));
  });

  // ---- drag-to-scroll the row --------------------------------------------
  // Mouse/pen only: touch already scrolls .ds-gallery natively via its own
  // overflow-x:auto, so handling touch here too would just double-process
  // the same gesture. DRAG_THRESHOLD tells an actual drag apart from a
  // click that trembled a pixel or two -- below it, pointerup still reaches
  // the image's own click listener below and selects/deselects normally;
  // at or past it, rowDragMoved suppresses that one click, the same
  // tap-vs-swipe distinction a touch UI makes natively.
  const DRAG_THRESHOLD = 4;
  let rowDragActive = false;
  let rowDragMoved = false;
  let rowDragStartX = 0;
  let rowDragStartScroll = 0;

  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    if (e.button !== 0) return;
    rowDragActive = true;
    rowDragMoved = false;
    rowDragStartX = e.clientX;
    rowDragStartScroll = track.scrollLeft;
    // Pointer capture is deliberately NOT taken here yet -- setting it
    // eagerly on every press (even a plain click that never moves) makes
    // browsers retarget the resulting synthetic `click` event to the
    // capturing element (this track) instead of whatever image was
    // actually under the cursor, which silently broke every image's own
    // click-to-select listener below. It's only acquired once real
    // dragging is confirmed, in pointermove.
  });

  track.addEventListener('pointermove', (e) => {
    if (!rowDragActive) return;
    const delta = e.clientX - rowDragStartX;
    if (!rowDragMoved && Math.abs(delta) > DRAG_THRESHOLD) {
      rowDragMoved = true;
      track.classList.add('is-dragging');
      track.setPointerCapture(e.pointerId);
    }
    if (rowDragMoved) track.scrollLeft = rowDragStartScroll - delta;
  });

  const endRowDrag = () => {
    rowDragActive = false;
    track.classList.remove('is-dragging');
  };
  track.addEventListener('pointerup', endRowDrag);
  track.addEventListener('pointercancel', endRowDrag);

  images.forEach((img) => {
    img.addEventListener('click', () => {
      if (rowDragMoved) {
        rowDragMoved = false;
        return;
      }
      toggle(img);
    });
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle(img);
      }
    });
  });

  // ---- interactive scrollbar ---------------------------------------------
  // Was a passive position/extent indicator only (aria-hidden, no
  // interaction of its own); explicit host request turned it into a real
  // control: drag the thumb, or click the track, to scroll -- and it grows
  // on hover/drag (see style.css) so it's easier to grab. role="scrollbar"
  // belongs on the thumb per the ARIA spec (it's the thumb that represents
  // the range value, not its track), with aria-controls pointing at the
  // scrollable element -- track needs a stable id for that, generated here
  // if the markup didn't already supply one (component instances that care
  // about a specific id, like localStorage-backed selection above, already
  // set one).
  const scrollbar = wrapper.querySelector(':scope > .ds-gallery__scrollbar');
  const thumb = scrollbar ? scrollbar.querySelector(':scope > .ds-gallery__scrollbar-thumb') : null;
  if (scrollbar && thumb) {
    if (!track.id) track.id = `ds-gallery-track-${wrapperIndex}`;
    scrollbar.removeAttribute('aria-hidden');
    thumb.setAttribute('role', 'scrollbar');
    thumb.setAttribute('aria-controls', track.id);
    thumb.setAttribute('aria-orientation', 'horizontal');
    thumb.setAttribute('tabindex', '0');

    const updateThumb = () => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      const visibleRatio = track.clientWidth / track.scrollWidth;
      const scrollRatio = maxScroll > 0 ? track.scrollLeft / maxScroll : 0;
      thumb.style.width = `${visibleRatio * 100}%`;
      thumb.style.left = `${scrollRatio * (1 - visibleRatio) * 100}%`;
      thumb.setAttribute('aria-valuemin', '0');
      thumb.setAttribute('aria-valuemax', '100');
      thumb.setAttribute('aria-valuenow', String(Math.round(scrollRatio * 100)));
    };

    // Drag the thumb directly.
    let thumbDragActive = false;
    let thumbDragStartX = 0;
    let thumbDragStartScroll = 0;

    thumb.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); // don't also fire the track's own click-to-jump below
      thumbDragActive = true;
      thumbDragStartX = e.clientX;
      thumbDragStartScroll = track.scrollLeft;
      thumb.setPointerCapture(e.pointerId);
      scrollbar.classList.add('is-dragging');
    });

    thumb.addEventListener('pointermove', (e) => {
      if (!thumbDragActive) return;
      const usable = scrollbar.clientWidth - thumb.offsetWidth;
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (usable <= 0 || maxScroll <= 0) return;
      const delta = e.clientX - thumbDragStartX;
      track.scrollLeft = thumbDragStartScroll + (delta / usable) * maxScroll;
    });

    const endThumbDrag = () => {
      thumbDragActive = false;
      scrollbar.classList.remove('is-dragging');
    };
    thumb.addEventListener('pointerup', endThumbDrag);
    thumb.addEventListener('pointercancel', endThumbDrag);

    // Click anywhere else on the track: jump the thumb (and the row) to
    // that position, same as clicking a native scrollbar's track.
    scrollbar.addEventListener('pointerdown', (e) => {
      if (e.target === thumb) return;
      const rect = scrollbar.getBoundingClientRect();
      const usable = scrollbar.clientWidth - thumb.offsetWidth;
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (usable <= 0 || maxScroll <= 0) return;
      const clickX = e.clientX - rect.left - thumb.offsetWidth / 2;
      const ratio = Math.min(1, Math.max(0, clickX / usable));
      track.scrollLeft = ratio * maxScroll;
    });

    // Keyboard: the thumb is a real Tab stop (role="scrollbar" requires
    // one), so it needs its own arrow-key/Home/End behavior -- native
    // scroll containers only respond to arrow keys when the CONTAINER
    // itself is focused, not an arbitrary focusable descendant of it.
    thumb.addEventListener('keydown', (e) => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 0) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        track.scrollLeft = Math.max(0, track.scrollLeft - track.clientWidth * 0.8);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        track.scrollLeft = Math.min(maxScroll, track.scrollLeft + track.clientWidth * 0.8);
      } else if (e.key === 'Home') {
        e.preventDefault();
        track.scrollLeft = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        track.scrollLeft = maxScroll;
      }
    });

    track.addEventListener('scroll', updateThumb);
    window.addEventListener('resize', updateThumb);
    updateThumb();
  }
});

/*
  Generic reset-trigger contract, same shape as popup's own data-popup-open:
  any button anywhere on the page (not necessarily inside this gallery's own
  markup -- popup's gallery-type body is exactly this case, a button
  composed by a different component entirely) can clear a gallery's
  selection by pointing data-gallery-reset at that gallery's own track id
  and dispatching the ds-gallery-reset event handled above. Kept as a
  separate, generic listener (not gallery-specific wiring baked into
  popup/component.js) so any future consumer gets the same "Reset
  selection" button for free just by using this attribute.

  Two-step confirm (explicit host request): a first click doesn't reset
  anything yet -- it just arms the button, swapping its label to "Yes,
  reset selection" and its status to "error" (text-button's own red status,
  see that component's own style.css/meta.json), so a destructive action
  isn't one accidental click away. A second click while armed actually
  dispatches ds-gallery-reset and reverts the button back to its original
  label/status; clicking anywhere else on the page while armed (a later
  explicit host request) also reverts it, WITHOUT resetting anything --
  same outside-click-to-cancel pattern dropdown-menu's own component.js
  already uses for its open menu, reused here rather than invented fresh.
*/
document.querySelectorAll('[data-gallery-reset]').forEach((trigger) => {
  const originalLabel = trigger.textContent;
  const originalStatus = trigger.dataset.status || 'active';
  let armed = false;

  function onOutsideClick(event) {
    if (trigger.contains(event.target)) return;
    disarm();
  }

  function disarm() {
    armed = false;
    trigger.textContent = originalLabel;
    trigger.dataset.status = originalStatus;
    document.removeEventListener('click', onOutsideClick);
  }

  trigger.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      trigger.textContent = 'Yes, reset selection';
      trigger.dataset.status = 'error';
      document.addEventListener('click', onOutsideClick);
      return;
    }

    disarm();
    const target = document.getElementById(trigger.dataset.galleryReset);
    if (target) target.dispatchEvent(new CustomEvent('ds-gallery-reset'));
  });
});
