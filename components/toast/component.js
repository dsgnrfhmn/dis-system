/*
  toast

  Structurally different from every other component.js in this repo:
  the rest wire behavior onto markup a page already rendered; a toast
  can't be pre-rendered, since it only exists because an action just
  happened (the consumer spec). So this file exposes a real
  runtime API instead of a passive querySelectorAll-and-wire pass:

    window.dsToast.show({
      message: 'Collection set saved.',
      status: 'default' | 'success' | 'warning' | 'error',  // default: 'default'
      actions: [{ label: 'View', onClick: fn }],  // optional
      duration: 5000,                    // ms, default 5000 -- not
                                          // spec-given (the consumer spec doesn't
                                          // state a number), flagged as
                                          // an invented default
    });

  Returns { dismiss } so a caller can remove it early if needed. Stack
  container (.ds-toast-stack) is created once, lazily, on first use --
  no page has to remember to add it. column-reverse in style.css (not
  this file) is what keeps new toasts appearing at the bottom of the
  stack while older ones get pushed up, without this file needing to
  care about insertion order itself -- plain appendChild always works.

  Hover-pauses the auto-dismiss timer (not spec-required, a small,
  flagged-as-added convenience so a toast with actions doesn't disappear
  out from under a reaching cursor) -- resumes with a fresh full duration
  on mouseleave, not the remaining time, since tracking exact remaining
  time across pause/resume is more bookkeeping than this warrants.
*/

(function () {
  function ensureStack() {
    let stack = document.querySelector('.ds-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'ds-toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function show({ message = '', status = 'default', actions = [], duration = 5000 } = {}) {
    const stack = ensureStack();

    const toast = document.createElement('div');
    toast.className = 'ds-toast';
    toast.dataset.status = status;
    toast.setAttribute('role', 'status');

    const body = document.createElement('div');
    body.className = 'ds-toast__body';
    toast.appendChild(body);
    const messageEl = document.createElement('span');
    messageEl.className = 'ds-toast__message';
    messageEl.textContent = message;
    body.appendChild(messageEl);

    if (actions.length) {
      const actionsEl = document.createElement('div');
      actionsEl.className = 'ds-toast__actions';
      actions.forEach((action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ds-text-button';
        button.dataset.priority = 'secondary';
        button.dataset.status = 'active';
        button.dataset.underline = 'dotted';
        button.textContent = action.label;
        if (action.onClick) button.addEventListener('click', action.onClick);
        actionsEl.appendChild(button);
      });
      body.appendChild(actionsEl);
    }
    // Close (Figma D_SYSTEM Toster's X): dismisses now; the toast still
    // auto-dismisses after `duration` if left alone.
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ds-toast__close';
    close.setAttribute('aria-label', 'Dismiss');
    close.addEventListener('click', () => dismiss());
    toast.appendChild(close);

    stack.appendChild(toast);

    let timer = setTimeout(dismiss, duration);
    function dismiss() {
      clearTimeout(timer);
      toast.remove();
    }
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
      timer = setTimeout(dismiss, duration);
    });
    // Keyboard/screen-reader users get the same pause via focus, not just
    // mouse hover -- a Tab-reachable action button inside the toast (see
    // above) keeps it alive while it holds focus, same reasoning as the
    // mouse case, added so this isn't a mouse-only mitigation.
    toast.addEventListener('focusin', () => clearTimeout(timer));
    toast.addEventListener('focusout', () => {
      timer = setTimeout(dismiss, duration);
    });

    return { dismiss };
  }

  window.dsToast = { show };
  // Template-rendered toasts (demo / showcase pages) carry the same close
  // button but no runtime wiring: close them on click too.
  document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-toast-dismiss]');
    if (close) close.closest('.ds-toast').remove();
  });
})();
