// Search USDA FoodData Central for a food to log or add to a recipe: the top matches (ranked like
// recipe import), Show More for the rest, then an amount from the food's own USDA portions.
// Resolves { name, servingSize, nutrients, volumeMl, source } for one serving, or undefined.
import { h, showDialog } from './dom.js';
import { field, numberInput, readNumber, selectInput } from './fields.js';
import { per100g, portionChoices, rankCandidates, scaleTo } from '../core/foodMatch.js';
import { getFoods, searchFoodsPage, UsdaError } from '../data/usda.js';
import { lookupsLeft } from './usageMeter.js';
import { roundTo } from '../core/units.js';
import { fmt } from './format.js';
import { state } from './state.js';

const PAGE = 15;        // results shown at a time
const FETCH_SIZE = 50;  // results fetched per USDA request (re-ranked, then shown 15 at a time)

export function searchUsdaFood(initialQuery = '') {
  const apiKey = state.settings.usda?.apiKey ?? '';
  let ranked = [];       // results in display order
  let shown = 0;
  let fetchedPages = 0;
  let totalHits = 0;
  let lastQuery = '';

  return showDialog((close) => {
    const body = h('div', { class: 'dialog-body food-search' });
    const query = h('input', { type: 'search', value: initialQuery, placeholder: 'e.g. banana, cottage cheese', enterkeyhint: 'search', 'aria-label': 'Food to search for' });
    const status = h('p', { class: 'muted search-status', role: 'status' });
    const list = h('ul', { class: 'search-results' });
    const more = h('button', { class: 'btn btn-block', type: 'button', hidden: true, onClick: () => showMore() }, 'Show More');
    const budget = () => {
      const left = lookupsLeft(apiKey);
      return `Each search and each food you pick uses one USDA lookup (${fmt(left)} left this hour).`;
    };
    const note = h('small', { class: 'muted' }, budget());

    const fail = (err, retry) => {
      status.replaceChildren(err instanceof UsdaError ? err.message : 'Something went wrong with the search.', ' ',
        h('button', { class: 'link-btn', type: 'button', onClick: retry }, 'Try again'));
    };

    // Each new page is ranked on its own and added after what's already shown, so the list doesn't reshuffle.
    async function fetchPage() {
      const { foods, totalHits: total } = await searchFoodsPage(lastQuery, apiKey, { pageSize: FETCH_SIZE, pageNumber: fetchedPages + 1 });
      fetchedPages++;
      totalHits = total;
      const known = new Set(ranked.map((f) => f.fdcId));
      ranked.push(...rankCandidates(lastQuery, foods).filter((f) => !known.has(f.fdcId)));
      return foods.length;
    }

    async function search() {
      const q = query.value.trim();
      if (!q) { query.focus(); return; }
      lastQuery = q; ranked = []; shown = 0; fetchedPages = 0; totalHits = 0;
      list.replaceChildren();
      more.hidden = true;
      status.textContent = 'Searching USDA…';
      try {
        await fetchPage();
      } catch (err) { fail(err, search); return; } finally { note.textContent = budget(); }
      if (!ranked.length) { status.textContent = `No USDA foods match “${q}”. Try a simpler name, like “yogurt” instead of a brand.`; return; }
      shown = Math.min(PAGE, ranked.length);
      renderList();
    }

    async function showMore() {
      if (shown >= ranked.length && fetchedPages * FETCH_SIZE < totalHits) {
        more.disabled = true;
        status.textContent = 'Loading more…';
        try { await fetchPage(); } catch (err) { more.disabled = false; fail(err, showMore); return; } finally { note.textContent = budget(); }
        more.disabled = false;
      }
      shown = Math.min(shown + PAGE, ranked.length);
      renderList();
    }

    function renderList() {
      const total = Math.max(totalHits, ranked.length);
      status.textContent = `Showing ${fmt(shown)} of ${fmt(total)} matches for “${lastQuery}”. Tap the closest one.`;
      list.replaceChildren(...ranked.slice(0, shown).map((food) => {
        const kcal = per100g(food.foodNutrients).calories;
        return h('li', {}, h('button', { class: 'result', type: 'button', onClick: () => pick(food) },
          h('strong', {}, food.description),
          h('small', { class: 'muted' }, `${kcal == null ? '–' : fmt(kcal)} kcal per 100 g · ${food.dataType === 'SR Legacy' ? 'USDA standard reference' : 'USDA foundation food'}`)));
      }));
      more.hidden = !(shown < ranked.length || fetchedPages * FETCH_SIZE < totalHits);
    }

    // Step 2: how much, from the food's USDA portions.
    async function pick(food) {
      body.replaceChildren(h('h2', {}, food.description), h('p', { class: 'muted', role: 'status' }, 'Loading amounts…'));
      let detail;
      try {
        [detail] = await getFoods([food.fdcId], apiKey);
      } catch (err) {
        body.replaceChildren(h('h2', {}, food.description), h('p', {}, err instanceof UsdaError ? err.message : 'Couldn’t load this food.'),
          h('div', { class: 'dialog-actions' }, h('button', { class: 'btn', type: 'button', onClick: showSearch }, 'Back'),
            h('button', { class: 'btn btn-primary', type: 'button', onClick: () => pick(food) }, 'Try again')));
        return;
      }
      const per100 = per100g(detail?.foodNutrients?.length ? detail.foodNutrients : food.foodNutrients);
      const choices = portionChoices(detail?.foodPortions ?? []);
      const OTHER = 'other';
      // Start on a familiar size ("1 medium") rather than USDA's label serving when there is one.
      const preferred = Math.max(0, choices.findIndex((c) => /\bmedium\b/i.test(c.label)));
      const amount = selectInput([...choices.map((c, i) => ({ value: String(i), label: c.label })), { value: OTHER, label: 'Other amount (grams)…' }], String(preferred), { 'aria-label': 'Amount' });
      const grams = numberInput('', { inputmode: 'decimal', placeholder: 'e.g. 85', 'aria-label': 'Grams' });
      const gramsRow = h('div', { class: 'input-unit', hidden: true }, grams, h('span', {}, 'g'));
      const preview = h('p', { class: 'entry-preview' });

      const current = () => {
        if (amount.value !== OTHER) return choices[Number(amount.value)];
        const g = readNumber(grams).value;
        return g > 0 ? { label: `${fmt(g, 1)} g`, grams: g, ml: null } : null;
      };
      const update = () => {
        gramsRow.hidden = amount.value !== OTHER;
        const c = current();
        if (!c) { preview.textContent = 'Enter the grams.'; return; }
        const n = scaleTo(per100, c.grams);
        preview.textContent = `${c.label}: ${fmt(n.calories ?? 0)} kcal · P ${fmt(n.protein ?? 0, 1)} g · C ${fmt(n.carbs ?? 0, 1)} g · F ${fmt(n.fat ?? 0, 1)} g`;
      };
      amount.addEventListener('change', () => { update(); if (amount.value === OTHER) grams.focus(); });
      grams.addEventListener('input', update);

      const use = () => {
        const c = current();
        if (!c) { grams.classList.add('invalid'); grams.focus(); return; }
        close({
          name: food.description,
          servingSize: c.label,
          nutrients: Object.fromEntries(Object.entries(scaleTo(per100, c.grams)).map(([k, v]) => [k, roundTo(v, 2)])),
          volumeMl: c.ml,
          source: { type: 'usda', fdcId: food.fdcId, description: food.description, grams: c.grams },
        });
      };

      body.replaceChildren(
        h('h2', {}, food.description),
        h('p', { class: 'muted' }, 'Choose how much you had. You can change the number of servings and any value on the next screen.'),
        field('Amount (one serving)', amount),
        gramsRow,
        preview,
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', type: 'button', onClick: showSearch }, 'Back'),
          h('button', { class: 'btn btn-primary', type: 'button', onClick: use }, 'Use this food')));
      update();
    }

    function showSearch() {
      body.replaceChildren(
        h('h2', {}, 'Search USDA'),
        h('form', { class: 'search-row', onSubmit: (e) => { e.preventDefault(); search(); } },
          query, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Search')),
        status, list, more, note,
        h('div', { class: 'dialog-actions' }, h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel')));
      if (ranked.length) renderList();
    }

    showSearch();
    if (initialQuery.trim()) setTimeout(search, 0); else setTimeout(() => query.focus(), 0);
    return body;
  });
}
