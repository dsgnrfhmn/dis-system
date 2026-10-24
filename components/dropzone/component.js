/*
  dropzone: drag and drop onto the label sets the file input's files (so the
  form submits it as if it had been picked); a choice shows the file row --
  name, size in MB, pixel size and a thumbnail for images (an object URL,
  revoked on remove or a new choice) -- and Remove clears the input and shows
  the drop area again. Emits ds-dropzone-change { file } on the root (file is
  null after Remove). Only the first file of a drop is taken.
*/
(function () {
  // The add icon: same currentScript-relative fetch as empty-state's.
  const ICONS_BASE = new URL('../../icons/', document.currentScript.src);
  document.querySelectorAll('.ds-dropzone__icon[data-icon]').forEach(async (el) => {
    try {
      const res = await fetch(new URL(`${el.dataset.icon}.svg`, ICONS_BASE));
      el.innerHTML = await res.text();
    } catch (err) {
      // icons/ unreachable -- the prompt text still says what to do
    }
  });

  const formatSize = (bytes) => {
    const mb = bytes / (1024 * 1024);
    return mb >= 0.1 ? `${mb.toFixed(1).replace('.', document.documentElement.lang === 'de' ? ',' : '.')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  document.querySelectorAll('[data-dropzone]').forEach((zone) => {
    const area = zone.querySelector('.ds-dropzone__area');
    const input = zone.querySelector('.ds-dropzone__input');
    const row = zone.querySelector('.ds-dropzone__file');
    const img = row.querySelector('img');
    const name = row.querySelector('.ds-dropzone__name');
    const meta = row.querySelector('.ds-dropzone__meta');
    let url = null;

    const release = () => { if (url) { URL.revokeObjectURL(url); url = null; } };
    const render = () => {
      const file = input.files && input.files[0];
      release();
      if (!file) {
        zone.removeAttribute('data-has-file');
        row.hidden = true;
        img.hidden = true;
      } else {
        zone.setAttribute('data-has-file', '');
        row.hidden = false;
        name.textContent = file.name;
        meta.textContent = formatSize(file.size);
        if (file.type.startsWith('image/')) {
          url = URL.createObjectURL(file);
          img.onload = () => { meta.textContent = `${formatSize(file.size)} · ${img.naturalWidth} × ${img.naturalHeight}`; };
          img.onerror = () => { img.hidden = true; };
          img.src = url;
          img.hidden = false;
        } else {
          img.hidden = true;
        }
      }
      zone.dispatchEvent(new CustomEvent('ds-dropzone-change', { bubbles: true, detail: { file: file || null } }));
    };

    ['dragenter', 'dragover'].forEach((type) => area.addEventListener(type, (event) => {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types).includes('Files')) return;
      event.preventDefault();
      zone.setAttribute('data-dragover', '');
    }));
    ['dragleave', 'dragend'].forEach((type) => area.addEventListener(type, (event) => {
      if (event.relatedTarget instanceof Node && area.contains(event.relatedTarget)) return;
      zone.removeAttribute('data-dragover');
    }));
    area.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.removeAttribute('data-dragover');
      const file = event.dataTransfer && event.dataTransfer.files[0];
      if (!file) return;
      const list = new DataTransfer();
      list.items.add(file);
      input.files = list.files;
      render();
    });
    input.addEventListener('change', render);
    row.querySelector('[data-dropzone-remove]').addEventListener('click', () => {
      input.value = '';
      render();
      input.focus();
    });
  });
})();
