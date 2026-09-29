/*
  radio

  Roving tabindex and arrow keys inside a .ds-radio-group: only the checked
  option is in the tab order, arrows move the choice, and a click checks an
  option. Dispatches ds-radio-change (bubbles, detail: { value }).
*/
document.querySelectorAll('.ds-radio-group').forEach((group) => {
  const options = () => Array.from(group.querySelectorAll('[role="radio"]'));
  const check = (target) => {
    options().forEach((option) => {
      const on = option === target;
      option.setAttribute('aria-checked', String(on));
      option.tabIndex = on ? 0 : -1;
    });
    target.dispatchEvent(new CustomEvent('ds-radio-change', { bubbles: true, detail: { value: target.dataset.value } }));
  };
  group.addEventListener('click', (event) => {
    const option = event.target.closest('[role="radio"]');
    if (option) check(option);
  });
  group.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    const list = options();
    const next = list[(list.indexOf(document.activeElement) + step + list.length) % list.length];
    event.preventDefault();
    next.focus();
    check(next);
  });
});
