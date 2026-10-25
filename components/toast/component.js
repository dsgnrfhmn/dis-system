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
                                          // an invented default; 0 = never
                                          // auto-dismissed, only the close button
      progress: 40,                      // optional: a running task's progress
                                          // line, 0-100, or null while it cannot
                                          // be told (the line moves); omitted: none
    });

  onClose (optional, explicit request 2026-10-25): the close button calls it
  instead of dismissing, so a host can ask first (stop a running task?) and
  dismiss through the returned dismiss() if the answer is yes.

  Returns { dismiss, update }. update({ message, progress }) changes the text
  and the progress line of a toast that is still shown (explicit request
  2026-10-25: a long task such as an export stays in one toast that follows it,
  with duration 0, until the host dismisses it). A toast with a progress line
  has no time line: it goes when its task does. Stack
  container (.ds-toast-stack) is created once, lazily, on first use --
  no page has to remember to add it. Since 2026-10-25 the stack is bottom
  right and new toasts appear below the older ones, next to the edge.

  Hover and focus pause the auto-dismiss timer (not spec-required, a small,
  flagged-as-added convenience so a toast with actions doesn't disappear
  out from under a reaching cursor). Since 2026-10-25 the toast shows the
  time left as a shrinking line (.ds-toast__timer), so the pause keeps the
  remaining time and the line stops with it (data-paused); leaving resumes
  both from there. Dismissing plays the fade-out (data-leaving, style.css)
  and removes the toast when it ends.
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

  function show({ message = '', status = 'default', actions = [], duration = 5000, progress, onClose } = {}) {
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

    // A toast with actions has no close icon: the actions sit in the same row as the
    // text, where the icon would be (maintainer, 2026-10-13). One without actions keeps
    // the X. Dismissing is then up to the actions and the auto-dismiss timer.
    if (actions.length) {
      toast.dataset.actions = '';
      const actionsEl = document.createElement('div');
      actionsEl.className = 'ds-toast__actions';
      actions.forEach((action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ds-text-button';
        button.dataset.priority = 'secondary';
        button.dataset.status = 'active';
        button.dataset.underline = 'dotted';
        // The label sits in text-button's own span: the dotted underline is drawn on it,
        // and text-button's component.js has already run, so it will not wrap bare text.
        const label = document.createElement('span');
        label.className = 'ds-text-button__text';
        label.textContent = action.label;
        button.appendChild(label);
        if (action.onClick) button.addEventListener('click', action.onClick);
        actionsEl.appendChild(button);
      });
      toast.appendChild(actionsEl);
    } else {
      // Close (Figma D_SYSTEM Toster's X): dismisses now; the toast still
      // auto-dismisses after `duration` if left alone.
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'ds-toast__close';
      close.setAttribute('aria-label', 'Dismiss');
      close.addEventListener('click', () => (onClose ? onClose() : dismiss()));
      toast.appendChild(close);
    }

    // duration 0 (or less): no auto-dismiss at all, only the close button
    // (explicit request 2026-10-01: a fetch's per-source result stays until
    // it is read and closed by hand). Such a toast has no time line either.
    const sticky = !(duration > 0);
    let bar = null;
    function setProgress(value) {
      if (value === undefined) return;
      if (!bar) {
        bar = document.createElement('span');
        bar.className = 'ds-toast__progress';
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        bar.setAttribute('aria-label', 'Progress');
        toast.appendChild(bar);
      }
      const v = Number(value);
      if (value === null || Number.isNaN(v)) {
        bar.setAttribute('data-indeterminate', '');
        bar.removeAttribute('aria-valuenow');
      } else {
        const clamped = Math.max(0, Math.min(100, v));
        bar.removeAttribute('data-indeterminate');
        bar.style.setProperty('--_toast-progress', `${clamped}%`);
        bar.setAttribute('aria-valuenow', String(Math.round(clamped)));
      }
    }
    setProgress(progress);
    if (!sticky && progress === undefined) {
      const line = document.createElement('span');
      line.className = 'ds-toast__timer';
      line.setAttribute('aria-hidden', 'true');
      toast.style.setProperty('--_toast-duration', `${duration}ms`);
      toast.appendChild(line);
    }

    stack.appendChild(toast);

    let remaining = duration;
    let started = 0;
    let timer = null;
    const run = () => {
      if (sticky || toast.hasAttribute('data-leaving')) return;
      started = Date.now();
      timer = setTimeout(dismiss, remaining);
      toast.removeAttribute('data-paused');
    };
    const pause = () => {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
      remaining = Math.max(0, remaining - (Date.now() - started));
      toast.setAttribute('data-paused', '');
    };
    function dismiss() {
      clearTimeout(timer);
      timer = null;
      if (toast.hasAttribute('data-leaving')) return;
      const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (still) {
        toast.remove();
        return;
      }
      toast.setAttribute('data-leaving', '');
      const gone = () => toast.remove();
      toast.addEventListener('animationend', (event) => { if (event.target === toast) gone(); });
      setTimeout(gone, 400);   // if the animation never runs
    }
    run();
    toast.addEventListener('mouseenter', pause);
    toast.addEventListener('mouseleave', () => { if (!toast.matches(':focus-within')) run(); });
    // Keyboard/screen-reader users get the same pause via focus, not just
    // mouse hover -- a Tab-reachable action button inside the toast (see
    // above) keeps it alive while it holds focus, same reasoning as the
    // mouse case, added so this isn't a mouse-only mitigation.
    toast.addEventListener('focusin', pause);
    toast.addEventListener('focusout', () => { if (!toast.matches(':hover')) run(); });

    function update({ message: text, progress: value } = {}) {
      if (typeof text === 'string') messageEl.textContent = text;
      setProgress(value);
    }

    return { dismiss, update };
  }

  window.dsToast = { show };
  // Template-rendered toasts (demo / showcase pages) carry the same close
  // button but no runtime wiring: close them on click too.
  document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-toast-dismiss]');
    if (close) close.closest('.ds-toast').remove();
  });
})();
