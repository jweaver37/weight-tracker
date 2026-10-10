// In-memory copy of the active user's settings, kept in sync with storage.
import * as repo from '../data/repo.js';
import { withDefaults } from '../core/settings.js';

export const state = { settings: null };

export async function loadSettings() {
  state.settings = withDefaults(await repo.getSettings());
  return state.settings;
}

export async function saveSettings(next) {
  state.settings = withDefaults(await repo.saveSettings(next));
  return state.settings;
}
