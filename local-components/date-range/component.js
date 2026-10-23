/*
  date-range (STAGED, see style.css)

  Draws the month grid of every .ds-date-range and keeps its range:
  - first click on a day starts a range, the second click ends it (either
    order: an earlier second day becomes the start); while only the start is
    set, hovering a day previews the range;
  - a preset (data-preset: today, week, weekend, next7, next30) sets a whole
    range at once; Clear empties it;
  - the arrows (and PageUp / PageDown in the grid) change the month; arrow
    keys move the focused day, Home / End to the week's ends.

  Every finished change dispatches `ds-date-range-change` (bubbles) from the
  panel with detail { start, end, preset }: start / end are YYYY-MM-DD (both
  inclusive) or null when cleared, preset is the preset's name or null.
  The current range is also kept on the panel as data-start / data-end.

  Popover: a button with data-date-range-trigger and aria-controls="<panel
  id>" opens and closes a [data-popover] panel (aria-expanded on the
  trigger); a click outside, Escape, or a finished range closes it.

  Runtime API, for panels a page adds later or drives itself:
    window.dsDateRange.init(panel)
    window.dsDateRange.set(panel, { start, end })   // no event
    window.dsDateRange.open(panel) / .close(panel)

  Dates are calendar days in the browser's local time zone: no time of day,
  so no DST edge can shift a day.
*/
(function () {
  if (window.dsDateRange) return;

  var WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  var LOCALE = 'en-GB';
  var monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
  var dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
  var longFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // --- day arithmetic on "YYYY-MM-DD" strings --------------------------------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null;
  }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function today() { return iso(new Date()); }
  function weekdayIndex(s) { return (parse(s).getDay() + 6) % 7; } // Monday = 0
  function firstOfMonth(s) { return s.slice(0, 8) + '01'; }
  function addMonths(first, n) { var d = parse(first); d.setDate(1); d.setMonth(d.getMonth() + n); return iso(d); }
  function lastOfMonth(first) { return addDays(addMonths(first, 1), -1); }

  function presetRange(name) {
    var t = today();
    var wd = weekdayIndex(t);
    switch (name) {
      case 'today': return [t, t];
      case 'week': return [t, addDays(t, 6 - wd)];
      case 'weekend': return wd >= 5 ? [t, addDays(t, 6 - wd)] : [addDays(t, 5 - wd), addDays(t, 6 - wd)];
      case 'next7': return [t, addDays(t, 6)];
      case 'next30': return [t, addDays(t, 29)];
    }
    return null;
  }

  var states = new WeakMap();

  function stateOf(panel) {
    var s = states.get(panel);
    if (!s) {
      var start = panel.dataset.start || null;
      s = {
        start: start,
        end: panel.dataset.end || null,
        pending: false,
        hover: null,
        preset: null,
        focus: start || panel.dataset.min || today(),
        view: firstOfMonth(start || panel.dataset.min || today())
      };
      if (s.start && !s.end) s.end = s.start;
      s.committed = { start: s.start, end: s.end };
      states.set(panel, s);
    }
    return s;
  }

  function inBounds(panel, day) {
    var min = panel.dataset.min;
    var max = panel.dataset.max;
    return !(min && day < min) && !(max && day > max);
  }

  function summary(s) {
    if (s.pending) return 'From ' + dayFmt.format(parse(s.start)) + ' — pick the last day';
    if (!s.start) return 'Any date';
    if (s.start === s.end) return dayFmt.format(parse(s.start));
    return dayFmt.format(parse(s.start)) + ' – ' + dayFmt.format(parse(s.end));
  }

  function render(panel) {
    var s = stateOf(panel);
    var grid = panel.querySelector('.ds-date-range__grid');
    var monthEl = panel.querySelector('.ds-date-range__month');
    if (!grid) return;
    monthEl.textContent = monthFmt.format(parse(s.view));

    var lo = s.start;
    var hi = s.pending ? (s.hover || s.start) : s.end;
    if (lo && hi && hi < lo) { var swap = lo; lo = hi; hi = swap; }

    var frag = document.createDocumentFragment();
    var head = document.createElement('div');
    head.setAttribute('role', 'row');
    head.style.display = 'contents';
    WEEKDAYS.forEach(function (name) {
      var cell = document.createElement('span');
      cell.className = 'ds-date-range__weekday';
      cell.setAttribute('role', 'columnheader');
      cell.textContent = name;
      head.appendChild(cell);
    });
    frag.appendChild(head);

    var first = s.view;
    var day = addDays(first, -weekdayIndex(first));
    var t = today();
    var month = first.slice(0, 7);
    if (s.focus.slice(0, 7) !== month) s.focus = inBounds(panel, first) ? first : (panel.dataset.min && panel.dataset.min.slice(0, 7) === month ? panel.dataset.min : first);
    for (var week = 0; week < 6; week++) {
      var row = document.createElement('div');
      row.setAttribute('role', 'row');
      row.style.display = 'contents';
      for (var i = 0; i < 7; i++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ds-date-range__day';
        b.dataset.day = day;
        b.setAttribute('role', 'gridcell');
        b.textContent = String(parse(day).getDate());
        b.setAttribute('aria-label', longFmt.format(parse(day)));
        if (day.slice(0, 7) !== month) b.dataset.outside = '';
        if (day === t) { b.dataset.today = ''; b.setAttribute('aria-current', 'date'); }
        if (!inBounds(panel, day)) b.disabled = true;
        var selected = lo && hi && day >= lo && day <= hi;
        if (selected) b.dataset.inRange = '';
        if (day === lo || day === hi) b.dataset.edge = '';
        b.setAttribute('aria-selected', String(Boolean(selected)));
        b.tabIndex = day === s.focus ? 0 : -1;
        row.appendChild(b);
        day = addDays(day, 1);
      }
      frag.appendChild(row);
    }
    grid.replaceChildren(frag);

    var prev = panel.querySelector('.ds-date-range__step[data-step="-1"]');
    var next = panel.querySelector('.ds-date-range__step[data-step="1"]');
    if (prev) prev.disabled = Boolean(panel.dataset.min && addDays(first, -1) < panel.dataset.min);
    if (next) next.disabled = Boolean(panel.dataset.max && addMonths(first, 1) > panel.dataset.max);

    var sum = panel.querySelector('.ds-date-range__summary');
    if (sum) sum.textContent = summary(s);
    panel.querySelectorAll('[data-preset]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.preset === s.preset));
    });
    var clear = panel.querySelector('[data-date-range-clear]');
    if (clear) {
      clear.disabled = !s.start;
      clear.dataset.status = s.start ? 'active' : 'disabled';
    }
    // The attributes carry the committed range only, never a half-picked one.
    if (s.committed.start) { panel.dataset.start = s.committed.start; } else { delete panel.dataset.start; }
    if (s.committed.end) { panel.dataset.end = s.committed.end; } else { delete panel.dataset.end; }
  }

  function revert(s) {
    s.pending = false;
    s.hover = null;
    s.start = s.committed.start;
    s.end = s.committed.end;
  }

  function commit(panel) {
    var s = stateOf(panel);
    s.committed = { start: s.start, end: s.start ? s.end : null };
    render(panel);
    panel.dispatchEvent(new CustomEvent('ds-date-range-change', {
      bubbles: true,
      detail: { start: s.start, end: s.start ? s.end : null, preset: s.preset }
    }));
    if (panel.hasAttribute('data-popover')) close(panel);
  }

  function focusDay(panel, day) {
    var s = stateOf(panel);
    if (!inBounds(panel, day)) return;
    s.focus = day;
    if (firstOfMonth(day) !== s.view) s.view = firstOfMonth(day);
    render(panel);
    var b = panel.querySelector('.ds-date-range__day[data-day="' + day + '"]');
    if (b) b.focus();
  }

  function pick(panel, day) {
    var s = stateOf(panel);
    s.preset = null;
    s.focus = day;
    if (!s.pending) {
      s.start = day;
      s.end = null;
      s.pending = true;
      s.hover = day;
      render(panel);
      var b = panel.querySelector('.ds-date-range__day[data-day="' + day + '"]');
      if (b) b.focus();
      return;
    }
    s.pending = false;
    s.hover = null;
    if (day < s.start) { s.end = s.start; s.start = day; } else { s.end = day; }
    commit(panel);
  }

  function init(panel) {
    if (panel.dataset.dateRangeReady) return;
    panel.dataset.dateRangeReady = '';
    stateOf(panel);

    panel.addEventListener('click', function (event) {
      var target = event.target.closest('button');
      if (!target || target.disabled || !panel.contains(target)) return;
      var s = stateOf(panel);
      if (target.dataset.day) {
        pick(panel, target.dataset.day);
      } else if (target.dataset.step) {
        s.view = addMonths(s.view, Number(target.dataset.step));
        render(panel);
      } else if (target.dataset.preset) {
        var range = presetRange(target.dataset.preset);
        if (!range) return;
        s.start = range[0]; s.end = range[1]; s.pending = false; s.hover = null;
        s.preset = target.dataset.preset;
        s.focus = range[0];
        s.view = firstOfMonth(range[0]);
        commit(panel);
      } else if (target.hasAttribute('data-date-range-clear')) {
        s.start = null; s.end = null; s.pending = false; s.hover = null; s.preset = null;
        commit(panel);
      }
    });

    panel.addEventListener('mouseover', function (event) {
      var s = stateOf(panel);
      var b = event.target.closest('.ds-date-range__day');
      if (!s.pending || !b || b.disabled || s.hover === b.dataset.day) return;
      s.hover = b.dataset.day;
      render(panel);
    });

    panel.addEventListener('keydown', function (event) {
      var b = event.target.closest('.ds-date-range__day');
      if (!b) return;
      var day = b.dataset.day;
      var moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      var next = null;
      if (event.key in moves) next = addDays(day, moves[event.key]);
      else if (event.key === 'Home') next = addDays(day, -weekdayIndex(day));
      else if (event.key === 'End') next = addDays(day, 6 - weekdayIndex(day));
      else if (event.key === 'PageUp' || event.key === 'PageDown') {
        var d = parse(day);
        d.setMonth(d.getMonth() + (event.key === 'PageUp' ? -1 : 1));
        next = iso(d);
      }
      if (!next) return;
      event.preventDefault();
      event.stopPropagation(); // not the page's own keyboard layer
      var s = stateOf(panel);
      if (s.pending) s.hover = next;
      focusDay(panel, next);
    });

    render(panel);
  }

  function set(panel, range) {
    var s = stateOf(panel);
    s.start = (range && range.start) || null;
    s.end = s.start ? ((range && range.end) || s.start) : null;
    s.pending = false; s.hover = null; s.preset = (range && range.preset) || null;
    s.committed = { start: s.start, end: s.end };
    if (s.start) { s.view = firstOfMonth(s.start); s.focus = s.start; }
    render(panel);
  }

  // --- popover --------------------------------------------------------------
  function triggersOf(panel) {
    return panel.id ? document.querySelectorAll('[data-date-range-trigger][aria-controls="' + panel.id + '"]') : [];
  }

  function open(panel) {
    if (!panel.hidden) return;
    document.querySelectorAll('.ds-date-range[data-popover]:not([hidden])').forEach(close);
    panel.hidden = false;
    triggersOf(panel).forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
    var s = stateOf(panel);
    if (s.pending) revert(s);
    s.view = firstOfMonth(s.start || panel.dataset.min || today());
    s.focus = s.start || (panel.dataset.min && panel.dataset.min > today() ? panel.dataset.min : today());
    render(panel);
    var b = panel.querySelector('.ds-date-range__day[tabindex="0"]');
    if (b) b.focus();
  }

  function close(panel) {
    if (panel.hidden) return;
    var s = stateOf(panel);
    // An unfinished pick is dropped: the range stays what it was.
    if (s.pending) { revert(s); render(panel); }
    panel.hidden = true;
    var focusInside = panel.contains(document.activeElement);
    triggersOf(panel).forEach(function (t, i) {
      t.setAttribute('aria-expanded', 'false');
      if (focusInside && i === 0) t.focus();
    });
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-date-range-trigger]');
    if (trigger) {
      var panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (panel) {
        if (panel.hidden) open(panel); else close(panel);
      }
      return;
    }
    // composedPath, not contains(): a day click re-draws the grid, so by now
    // the clicked button may no longer be in the panel.
    var path = event.composedPath();
    document.querySelectorAll('.ds-date-range[data-popover]:not([hidden])').forEach(function (panel) {
      if (path.indexOf(panel) === -1) close(panel);
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var openPanel = document.querySelector('.ds-date-range[data-popover]:not([hidden])');
    if (!openPanel) return;
    event.preventDefault();
    event.stopPropagation();
    close(openPanel);
  }, true);

  function start() {
    document.querySelectorAll('.ds-date-range').forEach(init);
    document.querySelectorAll('[data-date-range-trigger]').forEach(function (t) {
      t.setAttribute('aria-haspopup', 'dialog');
      t.setAttribute('aria-expanded', 'false');
    });
  }

  window.dsDateRange = { init: init, set: set, open: open, close: close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
