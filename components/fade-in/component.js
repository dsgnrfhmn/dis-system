/*
  fade-in

  Make what loads in fade in, element by element. Load this as a plain script
  early (it has to be watching before the page renders its data), then call
  window.dsFadeIn.settle() once the first data is in:

    window.dsFadeIn.settle();   // first load is over

  - Until settle() (or a 10s fail-safe), every element inserted into the page
    gets .ds-fade-in: the topmost inserted element of each batch, so a table
    filled with rows fades row by row, not row and every cell inside it.
  - An <img> that is still downloading when it is inserted is held invisible
    (data-ds-fade-pending) and fades in when it has loaded. This part keeps
    working after settle(): a thumbnail arriving late fades in at any time.
  - After settle(), elements the page re-renders (sort, filter, status change)
    are not animated: only things that were loading fade, never every change.

  Not animated: script/style/link, hidden elements, SVG internals, toasts, and
  anything inside [data-fade-skip].
*/
(function () {
  if (window.dsFadeIn) return;

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, TEMPLATE: 1, NOSCRIPT: 1 };
  var settled = false;
  var observer = null;

  function skipped(el) {
    if (SKIP_TAGS[el.tagName] || el.hidden) return true;
    if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml') return true;
    return !!el.closest('.ds-toast-stack, [data-fade-skip], svg');
  }

  function fade(el) {
    el.classList.add('ds-fade-in');
    el.addEventListener('animationend', function done(event) {
      if (event.target !== el) return;
      el.classList.remove('ds-fade-in');
      el.removeEventListener('animationend', done);
    });
  }

  function holdImage(img) {
    if (img.complete && img.naturalWidth > 0) return;
    if (img.complete && !img.getAttribute('src')) return;
    img.setAttribute('data-ds-fade-pending', '');
    function arrive() {
      img.removeAttribute('data-ds-fade-pending');
      fade(img);
    }
    img.addEventListener('load', arrive, { once: true });
    img.addEventListener('error', function () {
      img.removeAttribute('data-ds-fade-pending');
    }, { once: true });
  }

  function handle(records) {
    var added = [];
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) added.push(node);
      });
    });
    if (!added.length) return;

    added.forEach(function (node) {
      if (!node.isConnected || skipped(node)) return;
      if (!settled) {
        // Topmost only: a node whose ancestor was inserted in the same batch
        // rides on that ancestor's fade.
        var covered = added.some(function (other) {
          return other !== node && other.contains(node);
        });
        if (!covered) fade(node);
      }
      var images = node.tagName === 'IMG' ? [node] : Array.prototype.slice.call(node.querySelectorAll('img'));
      images.forEach(holdImage);
    });
  }

  function watch() {
    if (observer) return;
    observer = new MutationObserver(handle);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function settle() {
    settled = true;
  }

  watch();
  setTimeout(settle, 10000);

  window.dsFadeIn = { watch: watch, settle: settle };
})();
