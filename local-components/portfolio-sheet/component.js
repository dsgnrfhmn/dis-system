/*
  portfolio-sheet: the tone of a caption that sits over a picture.

  A caption with data-on="image" is white. When its picture loads, the part of
  the picture under the caption (the bottom right of the drawn box) is read
  through a small canvas; over a bright area the caption gets data-tone="light"
  and turns black (style.css). This is what the artist's PDF does page by page.
  Load events do not bubble, so one capturing listener on the document covers
  sheets the host renders later. A picture the canvas may not read (another
  origin) leaves the caption white.
*/
(function () {
  const LIGHT = 0.6;          // mean luminance (0..1) from which the caption turns black
  const SAMPLE = 32;          // the sampled area is drawn this many pixels wide

  function tone(img, caption) {
    const sheet = img.closest('.ds-portfolio-sheet');
    if (!sheet || !img.naturalWidth) return;
    const box = img.getBoundingClientRect();
    const cap = caption.getBoundingClientRect();
    if (!box.width || !box.height) return;
    // The caption's rectangle in the picture's own pixels, with object-fit: cover.
    const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const offX = (img.naturalWidth * scale - box.width) / 2;
    const offY = (img.naturalHeight * scale - box.height) / 2;
    const sx = Math.max(0, (cap.left - box.left + offX) / scale);
    const sy = Math.max(0, (cap.top - box.top + offY) / scale);
    const sw = Math.min(img.naturalWidth - sx, cap.width / scale);
    const sh = Math.min(img.naturalHeight - sy, cap.height / scale);
    if (sw <= 0 || sh <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE;
    canvas.height = Math.max(1, Math.round(SAMPLE * sh / sw));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    try {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      }
      caption.dataset.tone = sum / (data.length / 4) >= LIGHT ? 'light' : 'dark';
    } catch (error) {
      // A tainted canvas (another origin): keep the white caption.
    }
  }

  function check(img) {
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('ds-portfolio-sheet__image')) return;
    const caption = img.parentElement && img.parentElement.querySelector('.ds-portfolio-sheet__caption[data-on="image"]');
    if (caption) tone(img, caption);
  }

  document.addEventListener('load', (event) => check(event.target), true);
  // Pictures that finished loading before this script ran.
  document.querySelectorAll('img.ds-portfolio-sheet__image').forEach((img) => {
    if (img.complete) check(img);
  });
})();
