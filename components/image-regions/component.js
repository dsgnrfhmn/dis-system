/*
  image-regions: turns each region's data-x/-y/-w/-h (percent of the image)
  and each placeholder line's data-w into private custom properties, so a
  host passes data, never a style value. Values are clamped to 0-100.
*/
(function () {
  const pct = (v) => `${Math.max(0, Math.min(100, parseFloat(v) || 0))}%`;
  document.querySelectorAll('.ds-image-regions__region').forEach((el) => {
    ['x', 'y', 'w', 'h'].forEach((k) => el.style.setProperty(`--_${k}`, pct(el.dataset[k])));
  });
  document.querySelectorAll('.ds-image-regions__line').forEach((el) => {
    el.style.setProperty('--_w', pct(el.dataset.w));
  });
})();
