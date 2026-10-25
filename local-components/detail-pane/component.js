/*
  detail-pane: opens, closes and resizes a .ds-detail-split's side pane (STAGED, see
  style.css). The host builds and fills the pane; this only docks it.

    const pane = DsDetailPane.split(splitEl, { onClose });
    pane.open(id, paneEl);   // shows paneEl in the side (another id swaps the content)
    pane.close();            // slides it away; onClose runs on every close
    pane.openId;             // the open row's id, or null
    pane.pane();             // the open .ds-pane, or null

  Esc closes it, unless a field, a menu or a popup has the key. The side's left edge
  (.ds-split__handle) drags to resize it, ArrowLeft / ArrowRight 24px a step, between
  25% and 70% of the split; the width is not remembered across a reload.

    DsDetailPane.block(label, content)  // a labelled section; a string is a paragraph
    DsDetailPane.actions(buttons)       // a row of text buttons
*/
window.DsDetailPane = (function () {
  const MIN = 0.25;
  const MAX = 0.7;
  const STEP = 24;

  function split(splitEl, { onClose = () => {} } = {}) {
    const side = splitEl.querySelector('.ds-detail-split__side');
    const handle = side.querySelector('.ds-split__handle');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let openId = null;

    function setShare(share) {
      const s = Math.min(MAX, Math.max(MIN, share));
      splitEl.style.setProperty('--_side-share', String(s));
      splitEl.style.setProperty('--_side-track', `${s / (1 - s)}fr`);
      handle.setAttribute('aria-valuenow', String(Math.round(s * 100)));
    }
    const share = () => side.getBoundingClientRect().width / splitEl.getBoundingClientRect().width;

    handle.setAttribute('aria-valuemin', String(MIN * 100));
    handle.setAttribute('aria-valuemax', String(MAX * 100));
    let dragging = false;
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      dragging = true;
      handle.setPointerCapture(event.pointerId);
      splitEl.dataset.dragging = 'true';
      event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const box = splitEl.getBoundingClientRect();
      setShare((box.right - event.clientX) / box.width);
    });
    const finish = () => {
      dragging = false;
      delete splitEl.dataset.dragging;
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    handle.addEventListener('keydown', (event) => {
      const step = { ArrowLeft: STEP, ArrowRight: -STEP }[event.key];
      if (step === undefined) return;
      event.preventDefault();
      setShare(share() + step / splitEl.getBoundingClientRect().width);
    });

    // Opening and closing switch the split in one step inside a view transition (see
    // style.css): one layout, then the compositor animates between the two pictures.
    // Without view transitions or under reduced motion the switch is all there is.
    function move(change) {
      if (reduce.matches || !document.startViewTransition) {
        change();
        return Promise.resolve();
      }
      splitEl.dataset.moving = '';
      let transition;
      try {
        transition = document.startViewTransition({ update: change, types: ['ds-detail'] });
      } catch (error) {
        transition = document.startViewTransition(change);   // no transition types yet
      }
      return transition.finished.catch(() => {}).then(() => { delete splitEl.dataset.moving; });
    }

    function open(id, pane) {
      const wasOpen = splitEl.dataset.open === 'true';
      openId = id;
      pane.dataset.paneId = id;
      // In at once (another row: the content swaps in place). A closed side has no width,
      // so this shows nothing before the split opens.
      side.replaceChildren(handle, pane);
      if (!wasOpen) move(() => { splitEl.dataset.open = 'true'; });
    }

    function close() {
      if (splitEl.dataset.open !== 'true') return;
      openId = null;
      move(() => { delete splitEl.dataset.open; }).then(() => {
        if (splitEl.dataset.open !== 'true') side.replaceChildren(handle);
      });
      onClose();
    }

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || splitEl.dataset.open !== 'true') return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, .ds-dropdown, .ds-popup-overlay')) return;
      if (document.querySelector('.ds-popup-overlay:not([hidden])')) return;
      close();
    });

    return {
      side,
      open,
      close,
      get openId() { return openId; },
      pane() { return openId ? side.querySelector('.ds-pane') : null; },
    };
  }

  function block(label, content) {
    const section = document.createElement('section');
    section.className = 'ds-detail__block';
    const heading = document.createElement('h3');
    heading.className = 'ds-detail__label';
    heading.textContent = label;
    section.appendChild(heading);
    if (typeof content === 'string') {
      const text = document.createElement('p');
      text.className = 'ds-detail__text';
      text.textContent = content;
      section.appendChild(text);
    } else {
      section.appendChild(content);
    }
    return section;
  }

  function actions(buttons) {
    const row = document.createElement('div');
    row.className = 'ds-detail__actions';
    row.append(...buttons);
    return row;
  }

  return { split, block, actions };
}());
