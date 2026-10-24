/* ai-edit-bar: Enter in the input, or a click on the button, dispatches `ds-ai-edit-submit`
   (bubbles) from the bar with detail.prompt = the trimmed text. Escape dispatches
   `ds-ai-edit-close`. Nothing is sent while the bar is [data-busy]. The host decides what a
   prompt does and sets/clears data-busy. STAGED, see style.css. */
document.querySelectorAll('.ds-ai-edit-bar').forEach((bar) => {
  const input = bar.querySelector('.ds-ai-edit-bar__input');
  const button = bar.querySelector('.ds-ai-edit-bar__button');
  const submit = () => {
    if (bar.hasAttribute('data-busy')) return;
    bar.dispatchEvent(new CustomEvent('ds-ai-edit-submit', { bubbles: true, detail: { prompt: input.value.trim() } }));
  };
  button.addEventListener('click', submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape') {
      bar.dispatchEvent(new CustomEvent('ds-ai-edit-close', { bubbles: true }));
    }
  });
});
