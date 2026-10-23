/*
  progress-bar: sets the fill's width from data-value (0-100), now and
  whenever a host changes data-value (MutationObserver), keeping
  aria-valuenow in step.
*/
(function () {
  const apply = (bar) => {
    const v = Math.max(0, Math.min(100, parseFloat(bar.dataset.value)));
    if (Number.isNaN(v)) return;
    bar.style.setProperty('--_progress', `${v}%`);
    bar.setAttribute('aria-valuenow', String(Math.round(v)));
  };
  document.querySelectorAll('.ds-progress-bar').forEach((bar) => {
    apply(bar);
    new MutationObserver(() => apply(bar)).observe(bar, { attributes: true, attributeFilter: ['data-value'] });
  });
})();
