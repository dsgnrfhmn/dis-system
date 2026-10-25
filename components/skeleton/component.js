/*
  skeleton

  Placeholders for what is loading. Declarative: mark a container

    <div data-skeleton="row:4">      <!-- variant:count -->

  and once the HTML is parsed the container gets that many placeholders
  (variants: row, item, block, page; count defaults to 4). A <ul>/<ol> gets <li>
  placeholders. Elements marked [data-skeleton-hide] (an empty state that would
  be false while data is arriving) are hidden meanwhile.

    window.dsSkeleton.show(container, { variant: 'row', rows: 4 });
    window.dsSkeleton.clear();          // all of them; call it before rendering the data

  A container is also cleared as soon as real content is added to it. clear() is
  called by a 10s fail-safe, so a page whose data never arrives
  does not keep grey shapes forever. Placeholders are aria-hidden and
  data-fade-skip (fade-in leaves them alone); the container gets aria-busy while
  they are there.

  Pictures on their way: an <img class="ds-skeleton-image"> is grey and pulsing
  (style.css) until this script marks it data-loaded: "loaded" when its pixels
  arrive (it then fades in), "instant" when it was already loaded as it was put
  in the page, "error" when it failed. One capturing load/error listener and the
  insertion observer below cover pictures a host renders at any time. An <img>
  with no src yet stays a placeholder.
*/
(function () {
  if (window.dsSkeleton) return;

  var BARS = { row: 5, item: 1, block: 2, page: 1 };

  function make(container, variant) {
    var tag = /^(UL|OL)$/.test(container.tagName) ? 'li' : 'div';
    var el = document.createElement(tag);
    el.className = 'ds-skeleton';
    el.setAttribute('data-variant', variant);
    el.setAttribute('data-fade-skip', '');
    el.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < (BARS[variant] || 1); i += 1) {
      var bar = document.createElement('span');
      bar.className = 'ds-skeleton__bar';
      el.appendChild(bar);
    }
    return el;
  }

  function show(container, options) {
    if (!container) return;
    var variant = (options && options.variant) || 'row';
    var rows = (options && options.rows) || 4;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < rows; i += 1) frag.appendChild(make(container, variant));
    container.appendChild(frag);
    container.setAttribute('aria-busy', 'true');
    document.documentElement.setAttribute('data-skeleton', '');
  }

  function clear() {
    // A data-static skeleton is drawn by hand as an empty place (a preview with
    // nothing in it), not while loading, so it stays.
    document.querySelectorAll('.ds-skeleton:not([data-static])').forEach(function (el) { el.remove(); });
    document.querySelectorAll('[aria-busy="true"]').forEach(function (el) {
      if (el.hasAttribute('data-skeleton')) el.removeAttribute('aria-busy');
    });
    document.documentElement.removeAttribute('data-skeleton');
  }

  function scan() {
    document.querySelectorAll('[data-skeleton]').forEach(function (container) {
      var spec = (container.getAttribute('data-skeleton') || '').split(':');
      show(container, { variant: spec[0] || 'row', rows: parseInt(spec[1], 10) || 4 });
    });
  }

  // A container's placeholders go the moment real content is put into it, so
  // placeholders and data are never on screen together (a page that renders its
  // list in steps keeps the later parts grey until they arrive).
  function clearFilled(records) {
    records.forEach(function (record) {
      var target = record.target;
      if (!target.hasAttribute || !target.hasAttribute('data-skeleton')) return;
      var real = Array.prototype.some.call(record.addedNodes, function (node) {
        return node.nodeType === 1 && !node.classList.contains('ds-skeleton');
      });
      if (!real) return;
      Array.prototype.slice.call(target.children).forEach(function (child) {
        if (child.classList.contains('ds-skeleton')) child.remove();
      });
      target.removeAttribute('aria-busy');
    });
  }

  function settleImage(img, how) {
    if (!img.hasAttribute('data-loaded')) img.setAttribute('data-loaded', how);
  }

  // A picture already loaded when it is put in the page (from the cache, a redrawn
  // view) appears at once; one that already failed keeps the still grey.
  function checkImage(img) {
    if (!img.complete || !img.getAttribute('src')) return;
    settleImage(img, img.naturalWidth > 0 ? 'instant' : 'error');
  }

  function imagesIn(node) {
    if (node.nodeType !== 1) return [];
    if (node.matches('img.ds-skeleton-image')) return [node];
    return Array.prototype.slice.call(node.querySelectorAll('img.ds-skeleton-image'));
  }

  function checkAdded(records) {
    records.forEach(function (record) {
      Array.prototype.forEach.call(record.addedNodes, function (node) {
        imagesIn(node).forEach(checkImage);
      });
    });
  }

  function onPicture(how) {
    return function (event) {
      var img = event.target;
      if (img instanceof HTMLImageElement && img.classList.contains('ds-skeleton-image')) settleImage(img, how);
    };
  }
  document.addEventListener('load', onPicture('loaded'), true);
  document.addEventListener('error', onPicture('error'), true);

  function start() {
    scan();
    imagesIn(document.body).forEach(checkImage);
    new MutationObserver(function (records) {
      clearFilled(records);
      checkAdded(records);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  setTimeout(clear, 10000);

  window.dsSkeleton = { show: show, clear: clear };
})();
