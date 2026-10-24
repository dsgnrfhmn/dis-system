/* cv-sheet: lays CV blocks onto landscape sheets and scales them to a container.
   STAGED (see style.css). Window global: DsCvSheet.render(container, blocks, opts).

   Blocks are {kind: "heading" | "text", text}. A text block that starts with
   "YYYY<TAB>" is a dated row (year column + text, "\n" starts a new line in the
   text); any other text block is plain text. Block text is always set as text,
   never as markup.

   This is a preview layout (greedy fill by measured height), not the phase-two
   pagination engine: it decides nothing about exports and is not authoritative
   for page counts.

   Editing (opts.editable, blocks then carry an `id`): hovering a block shows Edit and
   Delete over its right end; Edit swaps the block for a textarea on the sheet (Save,
   Discard; Ctrl+Enter, Esc); a block is dragged to another place, across sheets too, but
   only among the blocks of the same year of the same section: the sections and their
   year sequence stay as they are (the same rule sets/cv_sets.reorder enforces; a heading
   never moves, entries with no year sort among themselves).
   The component only reports: editable = { onSave(id, text) -> Promise<boolean>,
   onDelete(id) -> Promise<boolean>, onReorder(ids), onEmpty() }. A false answer keeps the editor
   open (save) or brings the block back (delete). With opts.animate a re-render fades
   new blocks in and slides moved ones; fadeOut(container, id) is the way out.
   opts.actions === false keeps blocks identified and draggable but draws no Edit / Delete.
   opts.reveal = { id } or { index } scrolls that block (or the one now at that place,
   when a block was removed) into view, softly; a new block waits, hidden, until the
   scroll has arrived and only then fades in. reveal(container, spec) does the scroll alone
   and resolves when it ends, so a block out of view is scrolled to before it fades out. The sheets always fit the container's
   width (times the zoom), wider or narrower than a sheet. */
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

  const yearOf = (b) => {
    const m = b && b.kind !== 'heading' ? DATED.exec(b.text) : null;
    return m ? m[1] : null;
  };

  // `repeat`: the row above, on this sheet, has the same year. The year stays in the row
  // (so the column keeps its width and the text still copies whole) but is not drawn.
  function blockNode(b, repeat) {
    if (b.kind === 'heading') return el('h3', 'ds-cv-sheet__heading', b.text);
    const m = DATED.exec(b.text);
    if (!m) {
      const p = el('p', 'ds-cv-sheet__plain');
      lines(p, b.text);
      return p;
    }
    const row = el('div', 'ds-cv-sheet__row');
    const year = el('span', 'ds-cv-sheet__year', m[1]);
    if (repeat) year.dataset.repeat = 'true';
    row.appendChild(year);
    const t = el('span', 'ds-cv-sheet__text');
    lines(t, m[2]);
    row.appendChild(t);
    return row;
  }

  function button(label, action) {
    const b = el('button', 'ds-text-button');
    b.type = 'button';
    b.dataset.priority = 'secondary';
    b.dataset.status = 'active';
    b.dataset.underline = 'dotted';
    b.dataset.action = action;
    b.appendChild(el('span', 'ds-text-button__text', label));
    return b;
  }

  // The kind of place each block holds, as sets/cv_sets._slots: a heading holds its own;
  // any other block holds (its section, its year). A block may only trade places with
  // blocks that hold the same kind of place.
  function slotsOf(blocks) {
    let section = -1;
    return blocks.map((b, i) => {
      if (b.kind === 'heading') {
        section = i;
        return `h:${b.id}`;
      }
      return `e:${section}:${yearOf(b)}`;
    });
  }

  // `ids` is an order the user asks for: allowed when every position keeps its kind of place.
  function allowedOrder(blocks, ids) {
    const slots = slotsOf(blocks);
    const slotOf = new Map(blocks.map((b, i) => [b.id, slots[i]]));
    return ids.every((id, i) => slotOf.get(id) === slots[i]);
  }

  // The block as drawn on a sheet of an editable preview: the same node, marked with its
  // id and carrying its actions. Never used for measuring.
  function liveNode(b, withActions, repeat, movable) {
    const n = blockNode(b, repeat);
    n.classList.add('ds-cv-sheet__block');
    n.dataset.blockId = b.id;
    n.draggable = movable !== false;
    if (movable === false) n.dataset.fixed = 'true';
    if (withActions !== false) {
      const actions = el('span', 'ds-cv-sheet__actions');
      actions.appendChild(button('Edit', 'edit-block'));
      actions.appendChild(button('Delete', 'delete-block'));
      n.appendChild(actions);
    }
    return n;
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

  function sheet(pageBlocks, n, title, editable, withActions, movable) {
    const wrap = el('div', 'ds-cv-sheet');
    wrap.dataset.page = String(n);
    const page = el('div', 'ds-cv-sheet__page');
    const content = el('div', 'ds-cv-sheet__content');
    if (n === 1 && title) content.appendChild(el('h2', 'ds-cv-sheet__title', title));
    pageBlocks.forEach((b, i) => {
      // A year shows once for a run of rows with the same year; the first row of a sheet
      // always shows it.
      const repeat = i > 0 && yearOf(b) !== null && yearOf(b) === yearOf(pageBlocks[i - 1]);
      content.appendChild(editable ? liveNode(b, withActions, repeat, movable.has(b.id)) : blockNode(b, repeat));
    });
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
      const scale = (width / PAGE_W) * ZOOMS[zoomIndex(stack)];
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

  const FADE_MS = 180;
  const FADE_IN_MS = 220;
  const SLIDE_MS = 240;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scaleOf = (container) => parseFloat(container.style.getPropertyValue('--ds-cv-sheet-scale')) || 1;

  // Where every drawn block is now, by id: viewport top and the sheet it is on.
  function positions(container) {
    const map = new Map();
    const origin = container.getBoundingClientRect().top - container.scrollTop;
    container.querySelectorAll('[data-block-id]').forEach((n) => {
      const sheetNode = n.closest('.ds-cv-sheet');
      map.set(n.dataset.blockId, { top: n.getBoundingClientRect().top - origin, page: sheetNode && sheetNode.dataset.page });
    });
    return map;
  }

  // After a re-render: a block that was not there fades in, one that moved on its sheet
  // slides from where it was (FLIP), one that changed sheet fades in at its new place.
  function animateFrom(container, before) {
    const scale = scaleOf(container);
    const origin = container.getBoundingClientRect().top - container.scrollTop;
    container.querySelectorAll('[data-block-id]').forEach((n) => {
      const was = before.get(n.dataset.blockId);
      const page = n.closest('.ds-cv-sheet').dataset.page;
      n.style.opacity = '';
      if (!was || was.page !== page) {
        n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_IN_MS, easing: 'ease-out' });
        return;
      }
      const distance = (was.top - (n.getBoundingClientRect().top - origin)) / scale;
      if (Math.abs(distance) < 0.5) return;
      n.animate(
        [{ transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }],
        { duration: SLIDE_MS, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' }
      );
    });
  }

  // Brings a block into view: nothing when it is already well inside, else the scroller
  // glides so the block sits about a third from the top (or at its top edge when it is
  // taller than the view). Measured on the final layout, before the slide animations
  // start, so the transforms in flight do not skew it.
  function revealTarget(container, reveal) {
    const all = container.querySelectorAll('[data-block-id]');
    if (!all.length) return null;
    const node = reveal.id != null
      ? container.querySelector(`[data-block-id="${CSS.escape(reveal.id)}"]`)
      : all[Math.max(0, Math.min(all.length - 1, reveal.index))];
    if (!node) return null;
    const view = container.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    const margin = 24;
    if (r.top >= view.top + margin && r.bottom <= view.bottom - margin) return null;
    const top = r.top - view.top + container.scrollTop;
    const room = container.clientHeight - r.height;
    return Math.max(0, top - (room > 2 * margin ? room / 3 : margin));
  }

  // Scrolls softly and resolves when the scroller has arrived (scrollend, with a timer for
  // browsers that lack it); at once when there is nowhere to go or motion is off.
  function glideTo(container, top) {
    if (top === null || Math.abs(top - container.scrollTop) < 1) return Promise.resolve();
    if (reducedMotion()) {
      container.scrollTo({ top, behavior: 'auto' });
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        container.removeEventListener('scrollend', done);
        resolve();
      };
      const timer = setTimeout(done, 900);
      container.addEventListener('scrollend', done);
      container.scrollTo({ top, behavior: 'smooth' });
    });
  }

  /** Scrolls a block into view; resolves when done (at once if it is already in view). */
  function reveal(container, spec) {
    return glideTo(container, revealTarget(container, spec));
  }

  /** Fades a drawn block out in place; resolves when it is gone (at once without motion). */
  function fadeOut(container, id) {
    const n = container.querySelector(`[data-block-id="${CSS.escape(id)}"]`);
    if (!n || reducedMotion()) return Promise.resolve();
    return n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' }).finished
      .catch(() => {});
  }

  /** Brings a faded-out block back (the server refused the delete). */
  function restore(container, id) {
    const n = container.querySelector(`[data-block-id="${CSS.escape(id)}"]`);
    if (n) n.getAnimations().forEach((a) => a.cancel());
  }

  // ---- Editing on the sheet ----
  const handlers = new WeakMap();

  function startEdit(container, node) {
    const open = container.querySelector('[data-editing="true"]');
    if (open) endEdit(container, open, false);
    const blocks = container.__blocks;
    const block = blocks.find((b) => b.id === node.dataset.blockId);
    if (!block) return;
    node.dataset.editing = 'true';
    node.draggable = false;
    node.textContent = '';
    const ta = el('textarea', 'ds-cv-sheet__edit');
    ta.value = block.text;
    ta.spellcheck = false;
    ta.setAttribute('aria-label', 'Edit block');
    const fitHeight = () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; };
    ta.addEventListener('input', fitHeight);
    node.appendChild(ta);
    const actions = el('span', 'ds-cv-sheet__actions');
    actions.appendChild(button('Discard', 'discard-edit'));
    actions.appendChild(button('Save', 'save-edit'));
    node.appendChild(actions);
    fitHeight();
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  // Saving keeps the editor open when the page says no, so the text is not lost.
  async function endEdit(container, node, save) {
    const h = handlers.get(container);
    if (save) {
      const value = node.querySelector('.ds-cv-sheet__edit').value.trim();
      const block = container.__blocks.find((b) => b.id === node.dataset.blockId);
      if (!value) return h.onEmpty && h.onEmpty();
      if (block && value !== block.text && !(await h.onSave(block.id, value))) return;
    }
    if (!node.isConnected || node.dataset.editing !== 'true') return;
    // Nothing changed (or discarded): draw the block as it was.
    const block = container.__blocks.find((b) => b.id === node.dataset.blockId);
    if (block) node.replaceWith(liveNode(block, container.__actions, node.querySelector('[data-repeat]') !== null, node.dataset.fixed !== 'true'));
  }

  // ---- Drag to place: a block goes before or after the block under the pointer ----
  function dropTarget(container, event) {
    const over = event.target.closest && event.target.closest('[data-block-id]');
    if (over) {
      const r = over.getBoundingClientRect();
      return { node: over, where: event.clientY < r.top + r.height / 2 ? 'before' : 'after' };
    }
    const content = event.target.closest && event.target.closest('.ds-cv-sheet__content');
    const all = content && content.querySelectorAll('[data-block-id]');
    return all && all.length ? { node: all[all.length - 1], where: 'after' } : null;
  }

  function clearDrop(container) {
    container.querySelectorAll('[data-drop]').forEach((n) => delete n.dataset.drop);
  }

  function wire(container) {
    if (container.__wired) return;
    container.__wired = true;
    let dragId = null;
    container.addEventListener('click', (event) => {
      const b = event.target.closest('[data-action]');
      const node = event.target.closest('[data-block-id]');
      if (!b || !node || !container.contains(node)) return;
      const h = handlers.get(container);
      if (!h) return;
      const id = node.dataset.blockId;
      if (b.dataset.action === 'edit-block') startEdit(container, node);
      else if (b.dataset.action === 'discard-edit') endEdit(container, node, false);
      else if (b.dataset.action === 'save-edit') endEdit(container, node, true);
      else if (b.dataset.action === 'delete-block') {
        if (node.dataset.removing) return;
        node.dataset.removing = 'true';
        reveal(container, { id }).then(() => fadeOut(container, id)).then(async () => {
          const done = await h.onDelete(id);
          if (!done) {
            delete node.dataset.removing;
            restore(container, id);
          }
        });
      }
    });
    container.addEventListener('keydown', (event) => {
      const node = event.target.closest && event.target.closest('[data-editing="true"]');
      if (!node) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        endEdit(container, node, false);
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        endEdit(container, node, true);
      }
    });
    container.addEventListener('dragstart', (event) => {
      const node = event.target.closest && event.target.closest('[data-block-id]');
      if (!node || node.dataset.editing === 'true') return;
      dragId = node.dataset.blockId;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', dragId);
      node.dataset.dragging = 'true';
    });
    // The order that dropping `moved` before / after `target` would give.
    const orderFor = (moved, target, where) => {
      const ids = container.__blocks.map((b) => b.id).filter((id) => id !== moved);
      ids.splice(ids.indexOf(target) + (where === 'after' ? 1 : 0), 0, moved);
      return ids;
    };
    container.addEventListener('dragover', (event) => {
      if (dragId === null) return;
      const t = dropTarget(container, event);
      clearDrop(container);
      if (!t || t.node.dataset.blockId === dragId) return;
      // Only a place inside the block's own year (and section) takes the drop.
      if (!allowedOrder(container.__blocks, orderFor(dragId, t.node.dataset.blockId, t.where))) return;
      event.preventDefault();
      t.node.dataset.drop = t.where;
    });
    container.addEventListener('drop', (event) => {
      if (dragId === null) return;
      event.preventDefault();
      const t = dropTarget(container, event);
      const moved = dragId;
      clearDrop(container);
      if (!t || t.node.dataset.blockId === moved) return;
      const ids = orderFor(moved, t.node.dataset.blockId, t.where);
      if (!allowedOrder(container.__blocks, ids)) return;
      if (ids.join() !== container.__blocks.map((b) => b.id).join()) handlers.get(container).onReorder(ids);
    });
    container.addEventListener('dragend', () => {
      dragId = null;
      clearDrop(container);
      container.querySelectorAll('[data-dragging]').forEach((n) => delete n.dataset.dragging);
    });
  }

  /** Renders `blocks` into `container`; returns the number of sheets. */
  function render(container, blocks, opts) {
    const title = (opts && opts.title) || '';
    const editable = !!(opts && opts.editable);
    const before = opts && opts.animate && !reducedMotion() ? positions(container) : null;
    const scroll = { top: container.scrollTop, left: container.scrollLeft };
    container.__actions = !(opts && opts.actions === false);
    container.classList.add('ds-cv-sheet-stack');
    container.textContent = '';
    container.__blocks = blocks;
    if (editable) {
      handlers.set(container, opts.editable);
      wire(container);
    } else {
      handlers.delete(container);
    }
    if (!blocks.length) return 0;
    const avail = PAGE_H - TOP - FOOTER;
    const { m, titleH } = measure(blocks, title);
    const pages = paginate(blocks, m, avail, titleH);
    const slots = slotsOf(blocks);
    const sizes = new Map();
    slots.forEach((k) => sizes.set(k, (sizes.get(k) || 0) + 1));
    // A block is movable when some other block holds the same kind of place.
    const movable = new Set(blocks.filter((b, i) => sizes.get(slots[i]) > 1).map((b) => b.id));
    pages.forEach((p, i) => container.appendChild(sheet(p, i + 1, title, editable, container.__actions, movable)));
    fit(container);
    if (!observed.has(container) && typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => fit(container));
      ro.observe(container);
      observed.set(container, ro);
    }
    container.scrollTop = scroll.top;
    container.scrollLeft = scroll.left;
    const glide = opts && opts.reveal ? revealTarget(container, opts.reveal) : null;
    const token = (container.__render = (container.__render || 0) + 1);
    if (before && glide !== null && !reducedMotion()) {
      // Out of view: go there first, the new block stays hidden until the scroll arrives.
      container.querySelectorAll('[data-block-id]').forEach((n) => {
        const was = before.get(n.dataset.blockId);
        if (!was || was.page !== n.closest('.ds-cv-sheet').dataset.page) n.style.opacity = '0';
      });
      glideTo(container, glide).then(() => { if (token === container.__render) animateFrom(container, before); });
    } else {
      if (before) animateFrom(container, before);
      glideTo(container, glide);
    }
    return pages.length;
  }

  window.DsCvSheet = { render, zoomBy, fadeOut, restore, reveal };
})();
