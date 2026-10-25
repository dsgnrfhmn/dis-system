/*
  fade-in

  Make what loads in fade in, element by element. Load this as a plain script
  in the head (it watches from DOMContentLoaded on, before the page renders its
  data), then call
  window.dsFadeIn.settle() once the first data is in:

    window.dsFadeIn.settle();   // first load is over

  - Until settle() (or a 10s fail-safe), every element inserted into the page
    gets .ds-fade-in: the topmost inserted element of each batch, so a table
    filled with rows fades row by row, not row and every cell inside it.
  - An <img> that is still downloading when it is inserted is held invisible
    (data-ds-fade-pending) and fades in when it has loaded. This part keeps
    working after settle(): a thumbnail arriving late fades in at any time.
    Not a picture with skeleton's placeholder (class ds-skeleton-image): that one
    shows its grey box meanwhile and fades in on its own (skeleton).
  - After settle(), elements the page re-renders (sort, filter, status change)
    are not animated: only things that were loading fade, never every change.

  - An element with display: contents (a table row laid out as a grid) fades
    through its children, since it has no box of its own.

  Not animated: script/style/link, hidden elements and what is inside them (a
  closed popup), SVG internals, toasts, and anything inside [data-fade-skip].

  Hold (explicit request 2026-10-24, "content appears once, with the animation"):
  an element marked data-fade-hold in the HTML stays invisible, and nothing
  inserted inside it fades on its own, until settle(). Then it fades in once, as
  a whole, with whatever the page filled it with. A page whose first view needs
  several requests (a list, then the item, then a preview) marks its main area
  so the view arrives in one piece instead of in waves; it calls settle() when
  the last of them is drawn. The 10s fail-safe releases a hold too.

  Leave (explicit request 2026-10-24, "a disappearing animation too, faster than
  the appearing one"): dsFadeIn.leave(url) fades every [data-fade-region] out
  (200ms, against 450ms in) and then goes to url. A host marks the area under
  its nav bar data-fade-region and calls leave() from its own navigation links.
  Under prefers-reduced-motion it goes at once. A page restored from the
  back-forward cache comes back visible.
*/
(function () {
  if (window.dsFadeIn) return;

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, TEMPLATE: 1, NOSCRIPT: 1 };
  var settled = false;
  var observer = null;

  function skipped(el) {
    if (SKIP_TAGS[el.tagName] || el.hidden) return true;
    if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml') return true;
    return !!el.closest('.ds-toast-stack, [data-fade-skip], [data-fade-hold], [hidden], svg');
  }

  var STEP = 18;    // ms of delay per item of a batch
  var MAX_DELAY = 360;

  function fade(el, delay) {
    // A display: contents element (a grid table's row) has no box of its own to
    // fade: fade its children, which are the cells, with the row's delay.
    if (window.getComputedStyle(el).display === 'contents') {
      Array.prototype.forEach.call(el.children, function (child) {
        if (!skipped(child)) fade(child, delay);
      });
      return;
    }
    el.style.setProperty('--_fade-delay', delay + 'ms');
    el.classList.add('ds-fade-in');
    el.addEventListener('animationend', function done(event) {
      if (event.target !== el) return;
      el.classList.remove('ds-fade-in');
      el.style.removeProperty('--_fade-delay');
      el.removeEventListener('animationend', done);
    });
  }

  function holdImage(img) {
    // A picture with skeleton's placeholder (ds-skeleton-image) shows its grey box
    // while it loads and fades in by itself: hiding it here would hide the box.
    if (img.classList.contains('ds-skeleton-image')) return;
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

    var order = 0;
    added.forEach(function (node) {
      if (!node.isConnected || skipped(node)) return;
      if (!settled) {
        // Topmost only: a node whose ancestor was inserted in the same batch
        // rides on that ancestor's fade.
        var covered = added.some(function (other) {
          return other !== node && other.contains(node);
        });
        if (!covered) {
          fade(node, Math.min(order * STEP, MAX_DELAY));
          order += 1;
        }
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
    // Mutations the page made just before this call are still queued: fade
    // them first, then stop fading.
    if (observer) handle(observer.takeRecords());
    settled = true;
    // Held areas appear now, each as one piece.
    Array.prototype.forEach.call(document.querySelectorAll('[data-fade-hold]'), function (el) {
      el.removeAttribute('data-fade-hold');
      fade(el, 0);
    });
  }

  // Start once the HTML has been parsed: the parser's own insertions are the
  // static page, which is already there and does not fade. What the page
  // inserts from here on (its data) does.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
  setTimeout(settle, 10000);

  var LEAVE_MS = 200;

  function leave(url) {
    var regions = document.querySelectorAll('[data-fade-region]');
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!regions.length || still) {
      window.location.assign(url);
      return;
    }
    Array.prototype.forEach.call(regions, function (el) { el.setAttribute('data-fade-leaving', ''); });
    setTimeout(function () { window.location.assign(url); }, LEAVE_MS);
  }

  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-fade-leaving]'), function (el) {
      el.removeAttribute('data-fade-leaving');
    });
  });

  window.dsFadeIn = { watch: watch, settle: settle, leave: leave };
})();
