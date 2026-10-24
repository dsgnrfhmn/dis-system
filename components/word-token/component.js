/*
  word-token: opens a word's card on hover (after a short delay, so moving
  across a text does not flash cards) and on keyboard focus, at fixed
  coordinates under the word -- above it when there is no room below, and
  shifted to stay spacing-6 inside the viewport -- so a scrolling container
  never cuts it. Escape, a scroll or leaving the word closes it. A click on
  an interactive word emits ds-word-token-click { text } on the word
  (bubbling); the host decides what it means (add to notes, open the word)
  and sets data-state itself.
*/
(function () {
  const rootStyle = getComputedStyle(document.documentElement);
  const MARGIN = parseFloat(rootStyle.getPropertyValue('--ds-spacing-6')) || 20;
  const GAP = parseFloat(rootStyle.getPropertyValue('--ds-spacing-2')) || 4;
  const DELAY = 300;
  let open = null;
  let timer = 0;

  const close = () => {
    clearTimeout(timer);
    if (open) open.removeAttribute('data-open');
    open = null;
  };

  const place = (wrap) => {
    const word = wrap.querySelector(':scope > .ds-word-token');
    const card = wrap.querySelector(':scope > .ds-word-token__card');
    wrap.setAttribute('data-open', '');
    const r = word.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    let y = r.bottom + GAP;
    if (y + c.height > vh - MARGIN && r.top - GAP - c.height >= MARGIN) y = r.top - GAP - c.height;
    const x = Math.max(MARGIN, Math.min(r.left, vw - MARGIN - c.width));
    wrap.style.setProperty('--_card-x', `${x}px`);
    wrap.style.setProperty('--_card-y', `${y}px`);
  };

  const show = (wrap, delay) => {
    if (open === wrap) return;
    close();
    open = wrap;
    timer = setTimeout(() => { if (open === wrap && wrap.isConnected) place(wrap); }, delay);
  };

  document.querySelectorAll('.ds-word-token-wrap').forEach((wrap) => {
    const word = wrap.querySelector(':scope > .ds-word-token');
    const card = wrap.querySelector(':scope > .ds-word-token__card');
    if (!word) return;
    if (card) {
      wrap.setAttribute('data-js', '');
      word.addEventListener('mouseenter', () => show(wrap, DELAY));
      word.addEventListener('mouseleave', close);
      word.addEventListener('focus', () => { if (word.matches(':focus-visible')) show(wrap, 0); });
      word.addEventListener('blur', close);
    }
    if (word.tagName === 'BUTTON') {
      word.addEventListener('click', () => {
        word.dispatchEvent(new CustomEvent('ds-word-token-click', { bubbles: true, detail: { text: word.textContent } }));
      });
    }
  });

  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);
})();
