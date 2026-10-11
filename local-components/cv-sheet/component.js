/* cv-sheet: lays CV blocks onto landscape sheets and scales them to a container.
   STAGED (see style.css). Window global: DsCvSheet.render(container, blocks, opts).

   Blocks are {kind: "heading" | "text", text}. A text block that starts with
   "YYYY<TAB>" is a dated row (year column + text, "\n" starts a new line in the
   text); any other text block is plain text. Block text is always set as text,
   never as markup.

   This is a preview layout (greedy fill by measured height), not the phase-two
   pagination engine: it decides nothing about exports and is not authoritative
   for page counts. */
(function () {
  const PAGE_H = 599;
  const TOP = 42;
  const FOOTER = 50;
  const PAGE_W = 842;
  const DATED = /^(\d{4})\t([\s\S]*)$/;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function lines(parent, text) {
    text.split('\n').forEach((line, i) => {
      if (i) parent.appendChild(document.createElement('br'));
      parent.appendChild(document.createTextNode(line));
    });
  }

  function blockNode(b) {
    if (b.kind === 'heading') return el('h3', 'ds-cv-sheet__heading', b.text);
    const m = DATED.exec(b.text);
    if (!m) {
      const p = el('p', 'ds-cv-sheet__plain');
      lines(p, b.text);
      return p;
    }
    const row = el('div', 'ds-cv-sheet__row');
    row.appendChild(el('span', 'ds-cv-sheet__year', m[1]));
    const t = el('span', 'ds-cv-sheet__text');
    lines(t, m[2]);
    row.appendChild(t);
    return row;
  }

  function margins(node) {
    const s = getComputedStyle(node);
    return { top: parseFloat(s.marginTop) || 0, bottom: parseFloat(s.marginBottom) || 0 };
  }

  // Heights of every block in sheet units, measured in an off-screen sheet of the
  // real width so wrapping is what a sheet will show.
  function measure(blocks, title) {
    // In the document body, not in the stack: the stack's pane may be hidden (a closed
    // tab), and a hidden element has no layout to measure. It carries the stack class
    // so the sheet's custom properties apply.
    const host = el('div', 'ds-cv-sheet-stack ds-cv-sheet-measure');
    const page = el('div', 'ds-cv-sheet__page');
    const content = el('div', 'ds-cv-sheet__content');
    content.style.height = 'auto';
    content.style.overflow = 'visible';
    page.style.height = 'auto';
    page.style.transform = 'none';
    page.appendChild(content);
    host.appendChild(page);
    document.body.appendChild(host);
    const nodes = blocks.map(blockNode);
    const titleNode = title ? el('h2', 'ds-cv-sheet__title', title) : null;
    if (titleNode) content.appendChild(titleNode);
    nodes.forEach((n) => content.appendChild(n));
    const m = nodes.map((n) => {
      const mg = margins(n);
      return { h: n.getBoundingClientRect().height, top: mg.top, bottom: mg.bottom };
    });
    const titleH = titleNode ? titleNode.getBoundingClientRect().height + margins(titleNode).bottom : 0;
    host.remove();
    return { m, titleH };
  }

  // Greedy: a block goes on the current sheet if it fits; a heading must fit together
  // with the block after it. The top margin of the first block on a sheet is dropped,
  // as the stylesheet does.
  function paginate(blocks, m, avail, firstReserved) {
    const pages = [[]];
    let used = 0;
    let room = avail - firstReserved;
    blocks.forEach((b, i) => {
      const top = pages[pages.length - 1].length ? m[i].top : 0;
      let need = top + m[i].h + m[i].bottom;
      if (b.kind === 'heading' && i + 1 < blocks.length) need += m[i + 1].h + m[i + 1].bottom;
      if (pages[pages.length - 1].length && used + need > room) {
        pages.push([]);
        used = 0;
        room = avail;
        need = m[i].h + m[i].bottom;
        if (b.kind === 'heading' && i + 1 < blocks.length) need += m[i + 1].h + m[i + 1].bottom;
      }
      pages[pages.length - 1].push(b);
      used += pages[pages.length - 1].length === 1 ? m[i].h + m[i].bottom : top + m[i].h + m[i].bottom;
    });
    return pages;
  }

  function sheet(pageBlocks, n, title) {
    const wrap = el('div', 'ds-cv-sheet');
    wrap.dataset.page = String(n);
    const page = el('div', 'ds-cv-sheet__page');
    const content = el('div', 'ds-cv-sheet__content');
    if (n === 1 && title) content.appendChild(el('h2', 'ds-cv-sheet__title', title));
    pageBlocks.forEach((b) => content.appendChild(blockNode(b)));
    const foot = el('div', 'ds-cv-sheet__footer');
    const odd = n % 2 === 1;
    foot.dataset.side = odd ? 'left' : 'right';
    foot.appendChild(el('span', null, odd ? String(n) : 'CV'));
    foot.appendChild(el('span', null, '/'));
    foot.appendChild(el('span', null, odd ? 'CV' : String(n)));
    page.appendChild(content);
    page.appendChild(foot);
    wrap.appendChild(page);
    return wrap;
  }

  // Zoom multiplies the fit-to-width scale. It is kept on the container (data-zoom) so a
  // re-render of the same container keeps it.
  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  function zoomIndex(stack) {
    const i = ZOOMS.indexOf(parseFloat(stack.dataset.zoom));
    return i === -1 ? ZOOMS.indexOf(1) : i;
  }

  const observed = new WeakMap();
  function fit(stack) {
    const cs = getComputedStyle(stack);
    const width = stack.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (width > 0) {
      const scale = Math.min(1, width / PAGE_W) * ZOOMS[zoomIndex(stack)];
      stack.style.setProperty('--ds-cv-sheet-scale', String(scale));
    }
  }

  /** One zoom step (+1 in, -1 out). Returns {zoom, atMin, atMax} for the new level. */
  function zoomBy(stack, direction) {
    const i = Math.max(0, Math.min(ZOOMS.length - 1, zoomIndex(stack) + direction));
    stack.dataset.zoom = String(ZOOMS[i]);
    fit(stack);
    return { zoom: ZOOMS[i], atMin: i === 0, atMax: i === ZOOMS.length - 1 };
  }

  /** Renders `blocks` into `container`; returns the number of sheets. */
  function render(container, blocks, opts) {
    const title = (opts && opts.title) || '';
    container.classList.add('ds-cv-sheet-stack');
    container.textContent = '';
    if (!blocks.length) return 0;
    const avail = PAGE_H - TOP - FOOTER;
    const { m, titleH } = measure(blocks, title);
    const pages = paginate(blocks, m, avail, titleH);
    pages.forEach((p, i) => container.appendChild(sheet(p, i + 1, title)));
    fit(container);
    if (!observed.has(container) && typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => fit(container));
      ro.observe(container);
      observed.set(container, ro);
    }
    return pages.length;
  }

  window.DsCvSheet = { render, zoomBy };
})();
