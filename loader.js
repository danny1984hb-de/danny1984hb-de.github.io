(() => {
  const loader = document.getElementById('page-loader');
  if (!loader || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Never delay a ready page solely to display branding.
  if (document.readyState === 'complete') return;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    loader.classList.add('is-finished');
    window.setTimeout(() => { loader.hidden = true; }, 220);
  };
  loader.hidden = false;
  window.addEventListener('load', finish, { once: true });
  window.addEventListener('pageshow', finish, { once: true });
  document.addEventListener('keydown', finish, { once: true });
  window.setTimeout(finish, 2500);
})();
