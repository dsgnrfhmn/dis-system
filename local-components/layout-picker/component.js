/*
  layout-picker (STAGED in local-components, awaiting the maintainer's confirmation)

  A vertical column of square buttons, one per page layout, each showing a small
  drawing of that layout. It sits at the right middle of its positioned parent and
  shows while the parent is hovered or holds focus. The host builds it with
  DsLayoutPicker.html() and handles the clicks itself (a click on
  [data-layout-option] names the layout in data-layout-option); this script only
  writes the markup, so the drawings stay in style.css.

    DsLayoutPicker.html([{ name: 'pair', label: 'Two side by side' }, ...], 'pair')
    DsLayoutPicker.html(options, current, { remove: 'Delete this page' })

  remove (explicit request 2026-10-24): one more button at the bottom, set a little
  apart, with the trash icon (icons/delete.svg) and that label; a click on
  [data-layout-remove] is the host's to handle (ask first, then delete).

  Known drawings: full, figure, pair, triple, grid, grid-side, side, figure-side,
  band, auto (an outlined box: back to the automatic choice).
*/
(function () {
  if (window.DsLayoutPicker) return;

  // The parts of each drawing, in the order style.css places them.
  var PARTS = {
    full: ['img'],
    figure: ['img'],
    pair: ['img', 'img'],
    triple: ['img', 'img', 'img'],
    grid: ['img', 'img', 'img', 'img'],
    'grid-side': ['text', 'img', 'img', 'img', 'img'],
    side: ['text', 'img'],
    'figure-side': ['text', 'img'],
    band: ['text', 'img'],
    auto: [],
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function html(options, current, extra) {
    var buttons = options.map(function (o) {
      var parts = (PARTS[o.name] || []).map(function (p) { return '<i data-part="' + p + '"></i>'; }).join('');
      return '<button type="button" class="ds-layout-picker__button" data-layout-option="' + esc(o.name) + '"' +
        ' aria-pressed="' + (o.name === current) + '" aria-label="' + esc(o.label) + '" data-tooltip="' + esc(o.label) + '"' +
        ' data-tooltip-instant data-tooltip-placement="left"><span class="ds-layout-picker__glyph" data-glyph="' + esc(o.name) + '" aria-hidden="true">' +
        parts + '</span></button>';
    }).join('');
    var remove = extra && extra.remove
      ? '<button type="button" class="ds-layout-picker__button ds-layout-picker__remove" data-layout-remove aria-label="' +
        esc(extra.remove) + '" data-tooltip="' + esc(extra.remove) + '" data-tooltip-instant data-tooltip-placement="left">' +
        '<span class="ds-layout-picker__icon" aria-hidden="true"></span></button>'
      : '';
    return '<div class="ds-layout-picker" role="group" aria-label="Page layout">' + buttons + remove + '</div>';
  }

  window.DsLayoutPicker = { html: html };
})();
