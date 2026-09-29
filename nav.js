/*
  index.html's nav-bar wiring (the site's one root page). Left slot is
  plain "DIS-SYSTEM" text here, not nav-bar's own
  Penpot-sourced workspace-switcher dropdown (a deliberate host-level
  deviation per direct request -- see components/nav-bar/index.html
  for the component's own spec/demo, unaffected). So the only glyph this
  file loads is the theme icon.

  nav-bar has no opinion on how a host applies theming (see its meta.json
  rationale) -- it only swaps its own icon. This file owns the actual
  data-theme attribute and localStorage persistence, matching the root
  page's previous site.js behavior, and dispatches ds-theme-change so
  site.js can sync the embedded component iframes. Its icon
  fetches are root-relative (`icons/...`), not `../../icons/...` like
  components/nav-bar/component.js -- fetch() resolves against the
  *document's* URL, not the script file's, so reusing that file unmodified
  from a root-level page would 404.

  The center slot is empty: section navigation moved to index.html's
  sidebar (components/sidebar-list, see initSectionSidebar in site.js)
  when the category pages were merged into one long read, so the bar
  holds only the site title, Comments and the theme toggle.
*/

async function loadIcon(el) {
  if (!el) return;
  try {
    const res = await fetch(`icons/${el.dataset.icon}.svg`);
    el.innerHTML = await res.text();
  } catch (err) {
    // icons/ unreachable (e.g. opened without a server) -- leave empty
  }
}

const THEME_STORAGE_KEY = 'ds-theme';

function loadStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : 'light';
  } catch (err) {
    return 'light'; // localStorage unavailable (private mode, etc.)
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (err) {
    // ignore -- theme just won't persist this session
  }
}

function initNavBar() {
  const navBar = document.querySelector('.ds-nav-bar');
  if (!navBar) return;

  // Right: theme toggle -- the icon shows the theme a click switches TO;
  // the label names the CURRENT theme ("Light theme" / "Dark theme"), per
  // the Figma web-view nav (D_SYSTEM node 103:4594). The visible ".ds-nav-bar__theme-label" text is this
  // button's accessible name (aria-label dropped -- see
  // components/nav-bar/component.js's header comment for why).
  const themeToggle = navBar.querySelector('.ds-nav-bar__theme-toggle');
  const themeIcon = navBar.querySelector('.ds-nav-bar__theme-icon');
  const themeLabel = navBar.querySelector('.ds-nav-bar__theme-label');
  if (!themeToggle || !themeIcon || !themeLabel) return;

  const theme = loadStoredTheme();
  document.documentElement.dataset.theme = theme;
  const initialTarget = theme === 'dark' ? 'light' : 'dark';
  themeIcon.dataset.icon = initialTarget === 'dark' ? 'theme-dark' : 'theme-light';
  themeLabel.textContent = theme === 'dark' ? 'Dark theme' : 'Light theme';
  loadIcon(themeIcon);

  themeToggle.addEventListener('click', async () => {
    const switchingTo = themeIcon.dataset.icon === 'theme-dark' ? 'dark' : 'light';
    const nextOfferTheme = switchingTo === 'dark' ? 'light' : 'dark';
    themeIcon.dataset.icon = nextOfferTheme === 'dark' ? 'theme-dark' : 'theme-light';
    themeLabel.textContent = switchingTo === 'dark' ? 'Dark theme' : 'Light theme';
    await loadIcon(themeIcon);

    document.documentElement.dataset.theme = switchingTo;
    storeTheme(switchingTo);
    document.dispatchEvent(
      new CustomEvent('ds-theme-change', { detail: { theme: switchingTo } })
    );
  });
}

initNavBar();
