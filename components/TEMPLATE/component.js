/*
  TEMPLATE component: reduced text-button.

  Keep this file empty or minimal. Only add logic here if the component has
  actual behavior beyond CSS (state toggling, event dispatch, etc). Status
  is set by the host via data-status; this only dispatches a click event
  carrying priority/status so host pages/agents can hook in without this
  component knowing anything about its container.

  No framework. No build step assumed. Plain DOM APIs only. Wrap the file
  in an IIFE if it declares top-level consts: classic <script> tags share
  one global scope, so two component.js files declaring the same name on
  one consumer page would collide (see components/text-button/component.js).
*/

document.querySelectorAll('.ds-text-button').forEach((button) => {
  button.addEventListener('click', () => {
    button.dispatchEvent(
      new CustomEvent('ds-text-button-click', {
        bubbles: true,
        detail: {
          priority: button.dataset.priority,
          status: button.dataset.status,
        },
      })
    );
  });
});
