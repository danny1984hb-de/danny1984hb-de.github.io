(() => {
  const loader = document.getElementById('page-loader');
  if (!loader || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Intro appears only on index.html and lasts four seconds, including its fade.
  loader.hidden = false;
  const finish = () => { loader.classList.add('is-finished'); };
  const hide = () => { loader.hidden = true; };
  window.setTimeout(finish, 3800);
  window.setTimeout(hide, 4000);
  // Back/forward cache restores must not replay or leave a stale overlay.
  window.addEventListener('pageshow', (event) => { if (event.persisted) hide(); });
  // Keyboard navigation remains immediately usable.
  document.addEventListener('keydown', hide, { once: true });
})();
