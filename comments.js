/*
  Site-wide "Comments" scratchpad -- one plain-text field you type into
  directly (no Org-mode rendering or preview since 2026-09-27),
  shared across every root page (one localStorage key, not per-page), so
  reviewers can jot running notes while looking at any board.

  Composes the real components/popup (.ds-popup/.ds-popup-overlay/
  .ds-popup__*) exactly as documented -- that component intentionally
  models no open/close state or host wiring of its own (see its own
  component.js header comment: "focus trapping, Escape-to-close, backdrop
  click, actually toggling visibility is a host-application concern").
  This file is exactly that host wiring, for this one instance.

  Save/Cancel semantics match the popup component's own real button
  labels: edits only persist to localStorage on Save. Cancel (or
  Escape/backdrop click) discards in-progress edits and reverts to the
  last saved text next time the popup opens -- there is no silent
  autosave, so those controls stay meaningful.
*/

const COMMENTS_STORAGE_KEY = 'ds-comments';

function loadComments() {
  try {
    return localStorage.getItem(COMMENTS_STORAGE_KEY) || '';
  } catch (err) {
    return ''; // localStorage unavailable (private mode, etc.)
  }
}

function saveComments(value) {
  try {
    localStorage.setItem(COMMENTS_STORAGE_KEY, value);
  } catch (err) {
    // ignore -- comments just won't persist this session
  }
}

function initComments() {
  const trigger = document.getElementById('comments-trigger');
  const overlay = document.getElementById('comments-overlay');
  if (!trigger || !overlay) return;

  const textarea = overlay.querySelector('.ds-comments-input');
  const cancelBtn = overlay.querySelector('[data-comments-cancel]');
  const saveBtn = overlay.querySelector('[data-comments-save]');

  function onKeydown(event) {
    if (event.key === 'Escape') close();
  }

  function open() {
    textarea.value = loadComments();
    overlay.hidden = false;
    document.addEventListener('keydown', onKeydown);
    textarea.focus();
  }

  function close() {
    overlay.hidden = true;
    document.removeEventListener('keydown', onKeydown);
    trigger.focus();
  }

  trigger.addEventListener('click', open);
  cancelBtn.addEventListener('click', close);
  saveBtn.addEventListener('click', () => {
    saveComments(textarea.value);
    close();
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
}

initComments();
