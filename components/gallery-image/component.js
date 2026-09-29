/*
  gallery-image

  Type="image" instances still have no behavior of their own: which
  images are selected, and the order badge numbers, are host-application
  state (a real multi-select gallery keeps its own selection list) -- see
  gallery/component.js, which owns that model for the composed row.

  Type="text-icon" click-to-select IS wired here, on the component itself:
  explicit host request so the selected-state frame (data-selected, see
  style.css) can be tested interactively -- and a second explicit request
  turned it from an independent per-card toggle into single-select,
  radio-button semantics: only one text-icon card in a given group (its
  parent's other text-icon children) can be selected at a time, matching a
  native <input type="radio"> group exactly, including keyboard behavior
  (see below). Real role="radio"/role="radiogroup" + aria-checked +
  roving tabindex, not role="button"/aria-pressed (that pattern is for
  independent toggles, not mutually-exclusive single-select, and would
  misreport this control's actual semantics to assistive tech).

  Groups are formed by DOM parent, not a fixed selector list -- any set of
  sibling [data-type="text-icon"] cards sharing a parent becomes one
  radiogroup, so this keeps working if more such rows are added later
  without touching this file. Arrow keys move focus AND selection between
  siblings (wrapping at the ends), same as native radio groups; Enter/
  Space (re)select whatever's currently focused. Only the selected card
  (or the first, if none is) is tabbable at once -- a group is reached by
  Tab as a single stop, not once per radio, again matching native
  behavior.
*/

const groups = new Map();
document.querySelectorAll('.ds-gallery-image[data-type="text-icon"]').forEach((card) => {
  const group = card.parentElement;
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(card);
});

groups.forEach((cards, group) => {
  group.setAttribute('role', 'radiogroup');

  const select = (target) => {
    cards.forEach((card) => {
      const isTarget = card === target;
      card.setAttribute('data-selected', String(isTarget));
      card.setAttribute('aria-checked', String(isTarget));
      card.setAttribute('tabindex', isTarget ? '0' : '-1');
    });
  };

  cards.forEach((card, index) => {
    card.setAttribute('role', 'radio');
    const initiallySelected = card.getAttribute('data-selected') === 'true';
    card.setAttribute('aria-checked', String(initiallySelected));
    card.setAttribute('tabindex', initiallySelected ? '0' : '-1');

    card.addEventListener('click', () => select(card));

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(card);
        return;
      }
      const isNext = e.key === 'ArrowRight' || e.key === 'ArrowDown';
      const isPrev = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
      if (!isNext && !isPrev) return;
      e.preventDefault();
      const next = cards[(index + (isNext ? 1 : -1) + cards.length) % cards.length];
      select(next);
      next.focus();
    });
  });

  // No pre-selected card: keep the group keyboard-reachable by making the
  // first one the (sole) tab stop, matching native radiogroup behavior
  // rather than leaving every radio at tabindex="-1" and unreachable.
  if (!cards.some((card) => card.getAttribute('data-selected') === 'true')) {
    cards[0].setAttribute('tabindex', '0');
  }
});

/*
  type="picker": a picture that fails to load is hidden, so the card's
  placeholder fill shows instead of the browser's broken-image glyph.
  Captured on document (error events don't bubble), so it also covers
  cards a host renders after this script ran.
*/
document.addEventListener('error', (event) => {
  const img = event.target;
  if (img instanceof HTMLImageElement && img.classList.contains('ds-gallery-image__img')) {
    img.hidden = true;
  }
}, true);
document.querySelectorAll('.ds-gallery-image__img').forEach((img) => {
  if (img.complete && img.naturalWidth === 0) img.hidden = true;
});
