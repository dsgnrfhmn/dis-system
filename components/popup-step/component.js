/*
  popup-step -- accordion wiring for `.ds-popup-step__head[data-collapsible]`.

  A collapsible head toggles the .ds-popup-step__body right after it
  (data-collapsed on the head; style.css does the rest). A click on the head
  or Enter / Space on its title toggles; a click on a button inside the head
  (the "Reset the selection" action) does not. Pages that need to open or
  close steps from code use the one runtime API, so aria-expanded stays true:

    window.dsPopupStep.setOpen(headElement, true | false);
    window.dsPopupStep.isOpen(headElement);

  Non-collapsible steps are left alone.
*/
(function () {
  let uid = 0;

  function bodyOf(head) {
    const next = head.nextElementSibling;
    return next && next.classList.contains('ds-popup-step__body') ? next : null;
  }

  function trigger(head) {
    return head.querySelector('.ds-popup-step__title li');
  }

  function isOpen(head) {
    return !head.hasAttribute('data-collapsed');
  }

  function sync(head) {
    const item = trigger(head);
    if (item) item.setAttribute('aria-expanded', String(isOpen(head)));
  }

  function setOpen(head, open) {
    if (!head || !head.hasAttribute('data-collapsible')) return;
    if (open) head.removeAttribute('data-collapsed');
    else head.setAttribute('data-collapsed', '');
    sync(head);
  }

  function init(head) {
    if (head.dataset.stepReady) return;
    head.dataset.stepReady = 'true';
    const item = trigger(head);
    const body = bodyOf(head);
    if (item) {
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      if (body) {
        if (!body.id) body.id = 'ds-popup-step-body-' + ++uid;
        item.setAttribute('aria-controls', body.id);
      }
    }
    sync(head);
  }

  function heads() {
    return document.querySelectorAll('.ds-popup-step__head[data-collapsible]');
  }

  heads().forEach(init);

  document.addEventListener('click', (event) => {
    const head = event.target.closest('.ds-popup-step__head[data-collapsible]');
    if (!head || event.target.closest('button')) return;
    init(head);
    setOpen(head, !isOpen(head));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = event.target.closest && event.target.closest('.ds-popup-step__title li[role="button"]');
    const head = item && item.closest('.ds-popup-step__head[data-collapsible]');
    if (!head) return;
    event.preventDefault();
    setOpen(head, !isOpen(head));
  });

  window.dsPopupStep = { setOpen, isOpen, init: () => heads().forEach(init) };
})();
