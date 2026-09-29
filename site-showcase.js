/*
  Presentation cards on index.html (Figma D_SYSTEM nodes 132:4947 /
  132:4987): a card shows a category's representative set, and its
  "Show all components" button reveals every generated variant x state
  below it ("Hide all components" folds it again).

  One spec per category drives both lists, so the short row and the full
  list can't disagree. Buttons only for now.

  Must load BEFORE components/text-button/component.js: that script wraps
  bare labels, loads [data-icon] glyphs and wires click events for every
  .ds-text-button present when it runs, so the buttons built here have to
  exist by then. The markup mirrors components/text-button/template.html
  (same attributes, same child spans) -- change both together.
*/
(function () {
  // Figma D_SYSTEM button set: the seven types in the order of the card's
  // top row. `states` lists the states Figma draws for that type in the
  // expanded list (node 132:4987); icon-only has Default only there.
  const BUTTON_TYPES = [
    { label: 'Button', underline: 'solid' },
    { label: 'Button', underline: 'dotted' },
    { label: 'Button', underline: 'dotted', icon: 'notification', iconPosition: 'right' },
    { label: 'Button', underline: 'dotted', outlined: true },
    { label: 'Button', underline: 'dotted', icon: 'theme-dark' },
    { label: 'Switch to dark theme', icon: 'theme-dark', iconOnly: true, states: ['default'] },
    { label: 'Switch to dark theme', icon: 'theme-dark', iconOnly: true, outlined: true },
  ];
  const ALL_STATES = ['default', 'hover', 'disabled'];

  function textButton(spec, state) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ds-text-button';
    button.dataset.priority = 'secondary';
    button.dataset.status = state === 'disabled' ? 'disabled' : 'active';
    button.dataset.underline = spec.underline || 'solid';
    if (spec.outlined) button.dataset.outlined = 'true';
    if (spec.iconOnly) {
      button.dataset.iconOnly = 'true';
      button.setAttribute('aria-label', spec.label);
      button.title = spec.label;
    } else if (spec.icon && spec.iconPosition === 'right') {
      button.dataset.iconPosition = 'right';
    }
    if (state === 'hover') button.dataset.preview = 'hover';
    if (state === 'disabled') button.disabled = true;

    const icon = () => {
      const el = document.createElement('span');
      el.className = 'ds-text-button__icon';
      el.dataset.icon = spec.icon;
      el.setAttribute('aria-hidden', 'true');
      return el;
    };
    const label = () => {
      const el = document.createElement('span');
      el.className = 'ds-text-button__label';
      el.textContent = spec.label;
      return el;
    };
    if (spec.iconOnly) button.append(icon());
    else if (spec.icon && spec.iconPosition === 'right') button.append(label(), icon());
    else if (spec.icon) button.append(icon(), label());
    else button.textContent = spec.label;
    return button;
  }

  const SHOWCASES = {
    buttons: {
      representative: () => BUTTON_TYPES.map((spec) => textButton(spec, 'default')),
      all: () => BUTTON_TYPES.flatMap((spec) =>
        (spec.states || ALL_STATES).map((state) => textButton(spec, state))),
    },
  };

  document.querySelectorAll('[data-showcase]').forEach((el) => {
    const showcase = SHOWCASES[el.dataset.showcase];
    if (showcase) el.append(...showcase.representative());
  });
  document.querySelectorAll('[data-showcase-all]').forEach((el) => {
    const showcase = SHOWCASES[el.dataset.showcaseAll];
    if (showcase) el.append(...showcase.all());
  });

  // Toggle: aria-controls names the hidden list; the button's own label
  // flips between Show/Hide. text-button/component.js later wraps the bare
  // label in .ds-text-button__text, so the label is set on that span when
  // it exists, never by replacing the button's children.
  document.querySelectorAll('[data-showcase-toggle]').forEach((toggle) => {
    const list = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!list) return;
    toggle.addEventListener('click', () => {
      const open = list.hidden;
      list.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      const text = toggle.querySelector('.ds-text-button__text') || toggle;
      text.textContent = open ? 'Hide all components' : 'Show all components';
      // site.js re-measures the region's gallery iframes on open.
      list.dispatchEvent(new CustomEvent('ds-showcase-toggle', { bubbles: true, detail: { open } }));
    });
  });
})();
