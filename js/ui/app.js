// App entry: startup, hash routing and the bottom tab bar.
import { h } from './dom.js';
import { initUser } from '../data/repo.js';
import { openDb } from '../data/db.js';
import { isSetupComplete } from '../core/settings.js';
import { state, loadSettings } from './state.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderToday } from './screens/today.js';
import { renderWeight } from './screens/weight.js';
import { renderSettings } from './screens/settings.js';
import { renderRecipes } from './screens/recipes.js';
import { renderGoals } from './screens/goals.js';
import { renderReports } from './screens/reports.js';
import { checkMilestones } from './milestones.js';

// Icons are static markup defined here, never user data.
const ICONS = {
  today: '<svg viewBox="0 0 24 24"><path d="M4 11h16M8 3v4M16 3v4M5 7h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/></svg>',
  weight: '<svg viewBox="0 0 24 24"><path d="M4 18 9 12l4 3 7-8M15 7h5v5"/></svg>',
  goals: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m12 7.5 1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4Z"/></svg>',
  reports: '<svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  recipes: '<svg viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
};

const TABS = [
  { route: 'today', label: 'Today', render: renderToday },
  { route: 'weight', label: 'Weight', render: renderWeight },
  { route: 'recipes', label: 'Recipes', render: renderRecipes },
  { route: 'goals', label: 'Goals', render: renderGoals },
  { route: 'reports', label: 'Reports', render: renderReports },
  { route: 'settings', label: 'Settings', render: (view) => renderSettings(view, { onDataReplaced: route }) },
];

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');

function buildTabs() {
  tabbar.replaceChildren(...TABS.map((t) => {
    const icon = h('span', { class: 'tab-icon', 'aria-hidden': 'true' });
    icon.innerHTML = ICONS[t.route];
    return h('a', { href: `#/${t.route}`, class: 'tab', 'data-route': t.route }, icon, h('span', {}, t.label));
  }));
}

async function route() {
  try {
    if (!isSetupComplete(state.settings)) {
      document.body.classList.add('no-tabs');
      renderOnboarding(view, () => {
        document.body.classList.remove('no-tabs');
        location.hash = '#/today';
        route();
      });
      return;
    }
    // Routes look like #/today or #/recipes/<id>.
    const [name, param] = location.hash.replace(/^#\/?/, '').split('/');
    const tab = TABS.find((t) => t.route === name) ?? TABS[0];
    for (const a of tabbar.querySelectorAll('.tab')) a.classList.toggle('active', a.dataset.route === tab.route);
    await tab.render(view, param);
    window.scrollTo(0, 0);
    checkMilestones();
  } catch (err) {
    console.error(err);
    view.replaceChildren(h('section', { class: 'card errors' }, h('h2', {}, 'Something went wrong'), h('p', {}, String(err.message ?? err))));
  }
}

async function start() {
  try {
    await openDb();
  } catch (err) {
    view.replaceChildren(h('section', { class: 'card errors' },
      h('h2', {}, 'Storage unavailable'),
      h('p', {}, 'This browser blocked local storage (private browsing can do this). The app needs it to save your data.')));
    return;
  }
  // Ask the browser not to evict our data under storage pressure.
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker not registered', err));
  }
  await initUser();
  await loadSettings();
  buildTabs();
  window.addEventListener('hashchange', route);
  route();
}

start();
