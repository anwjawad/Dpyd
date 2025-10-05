
(function(){
  const KEY = 'app.theme';
  const THEMES = ['neon','ocean','rose','ember','mint','dawn'];
  const root = document.body;

  // Init current theme from localStorage if present
  const saved = localStorage.getItem(KEY);
  if (saved && THEMES.includes(saved)) root.setAttribute('data-theme', saved);

  // Expose setter globally (for legacy uses)
  window.setAppTheme = function(t){
    if (!THEMES.includes(t)) return;
    root.setAttribute('data-theme', t);
    try{ localStorage.setItem(KEY, t); }catch(e){}
    // Reflect active state
    document.querySelectorAll('.theme-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.theme === t);
    });
  };

  // Create floating switcher
  const host = document.createElement('div');
  host.id = 'theme-switcher';
  host.innerHTML = `
    <button id="theme-button" type="button" title="Change theme">Theme</button>
    <div id="theme-panel" role="menu" aria-label="Choose theme">
      <div class="row">
        ${THEMES.map(t => `<button class="theme-chip" data-theme="${t}" type="button">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}
      </div>
    </div>
  `;
  document.documentElement.appendChild(host);

  const btn = host.querySelector('#theme-button');
  const panel = host.querySelector('#theme-panel');
  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
  });

  // Choose theme
  panel.addEventListener('click', (e) => {
    const chip = e.target.closest('.theme-chip');
    if (!chip) return;
    const t = chip.dataset.theme;
    window.setAppTheme(t);
    // Close panel after selection
    panel.classList.remove('open');
  });

  // Close on outside click / escape
  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('open')) return;
    if (!host.contains(e.target)) panel.classList.remove('open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') panel.classList.remove('open');
  });

  // Mark active on load
  const current = root.getAttribute('data-theme') || THEMES[0];
  window.setAppTheme(current);
})();
