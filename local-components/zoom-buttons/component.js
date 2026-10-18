/* zoom-buttons: a click on "+" or "-" dispatches `ds-zoom-step` (bubbles) from the
   group with detail.direction = 1 | -1. The host zooms whatever it wants and may
   disable a button at its limit (button.disabled). STAGED, see style.css. */
document.querySelectorAll('.ds-zoom-buttons').forEach((group) => {
  group.addEventListener('click', (event) => {
    const button = event.target.closest('.ds-zoom-buttons__button');
    if (!button || button.disabled || !group.contains(button)) return;
    const direction = button.dataset.direction === 'in' ? 1 : -1;
    group.dispatchEvent(new CustomEvent('ds-zoom-step', { bubbles: true, detail: { direction } }));
  });
});
