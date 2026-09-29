/*
  paper-preview

  Blank pages, no click/keyboard behavior. The only real behavior here is
  the custom scrollbar for [data-mode="paged-preview"] -- same technique
  gallery/component.js already uses for its own horizontal scroll, ported
  to this component's vertical axis (scrollTop/scrollHeight/clientHeight
  in place of scrollLeft/scrollWidth/clientWidth). See style.css for why
  the native scrollbar is hidden and replaced with this indicator.
*/

document.querySelectorAll('.ds-paper-preview-wrapper').forEach((wrapper) => {
  const track = wrapper.querySelector(':scope > .ds-paper-preview');
  const thumb = wrapper.querySelector(':scope > .ds-paper-preview__scrollbar > .ds-paper-preview__scrollbar-thumb');
  if (!track || !thumb) return;

  const updateThumb = () => {
    const visibleRatio = track.clientHeight / track.scrollHeight;
    const maxScroll = track.scrollHeight - track.clientHeight;
    const scrollRatio = maxScroll > 0 ? track.scrollTop / maxScroll : 0;
    thumb.style.height = `${visibleRatio * 100}%`;
    thumb.style.top = `${scrollRatio * (1 - visibleRatio) * 100}%`;
  };

  let hideTimeout;
  track.addEventListener('scroll', () => {
    updateThumb();
    wrapper.classList.add('is-scrolling');
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => wrapper.classList.remove('is-scrolling'), 600);
  });

  window.addEventListener('resize', updateThumb);
  updateThumb();
});
