// "Swap…" for a recipe ingredient: pick a substitute (filterable by diet), confirm the amount, and
// get the substitute with USDA nutrition. The new ingredient remembers the original for Undo.
import { h, mount, showDialog } from './dom.js';
import { field } from './fields.js';
import { state } from './state.js';
import { parseIngredientLine } from '../core/ingredients.js';
import { findSubstitutes, swapLine, SWAP_TAGS, tagForFollowedDiet, tagsIn } from '../core/substitutes.js';
import { UsdaError } from '../data/usda.js';
import { lookUpIngredient } from './ingredientLookup.js';
import { classifyOil } from '../core/seedOils.js';

export const hasSubstitutes = (ingredient) => Boolean(findSubstitutes(ingredient.name));

// A vegan substitute is also vegetarian.
const fitsTag = (s, tag) => s.tags.includes(tag) || (tag === 'vegetarian' && s.tags.includes('vegan'));

// Resolves the replacement ingredient (with swappedFrom set), or undefined.
export function openSubstitutes(ingredient) {
  const group = findSubstitutes(ingredient.name);
  if (!group) return Promise.resolve(undefined);
  // Start on the person's preference: seed-oil free when swapping an oil they avoid, else their diet.
  const avoidingThisOil = state.settings.diet?.avoidSeedOils && ['seed', 'check'].includes(classifyOil(ingredient).kind);
  const followed = avoidingThisOil ? 'seed-oil-free' : tagForFollowedDiet(state.settings.diet?.follow);
  let tag = followed && group.subs.some((s) => fitsTag(s, followed)) ? followed : null;

  return showDialog((close) => {
    const body = h('div', { class: 'dialog-body' });

    const showList = () => {
      const tags = tagsIn(group.subs);
      if (tags.some((t) => t.key === 'vegan') && !tags.some((t) => t.key === 'vegetarian')) tags.push(SWAP_TAGS.find((t) => t.key === 'vegetarian'));
      const shown = group.subs.filter((s) => !tag || fitsTag(s, tag));
      mount(body,
        h('h2', {}, `Swap ${ingredient.name.toLowerCase()}`),
        h('p', { class: 'muted' }, `Substitutes for ${group.label}. Tap a diet to narrow the list.`),
        h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Diet' },
          tags.map((t) => h('button', {
            class: `chip-toggle ${tag === t.key ? 'on' : ''}`, type: 'button', 'aria-pressed': String(tag === t.key),
            onClick: () => { tag = tag === t.key ? null : t.key; showList(); },
          }, t.label))),
        h('ul', { class: 'swap-list' }, shown.map((s) => h('li', { class: 'swap-card' },
          h('div', { class: 'swap-head' },
            h('strong', {}, s.name),
            h('button', { class: 'btn btn-small btn-primary', type: 'button', onClick: () => showConfirm(s) }, 'Use this')),
          h('p', {}, s.what),
          h('div', { class: 'tag-row' }, s.tags.map((k) => h('span', { class: `swap-tag ${k === tag ? 'on' : ''}` }, SWAP_TAGS.find((t) => t.key === k)?.label ?? k))),
          h('small', { class: 'muted' }, h('strong', {}, 'How: '), s.how)))),
        !shown.length && h('p', { class: 'muted' }, 'No substitutes here for that diet.'),
        h('small', { class: 'muted' }, 'Swaps change taste and texture — baking especially may need adjusting. Diet tags describe the substitute itself; check labels for allergens.'),
        h('div', { class: 'dialog-actions' }, h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel')));
    };

    const showConfirm = (s) => {
      const line = h('input', { type: 'text', value: swapLine(ingredient, s, parseIngredientLine), 'aria-label': 'New ingredient line' });
      const errorBox = h('div', { class: 'errors', role: 'alert' });
      const swapBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Swap');
      const noNutritionBtn = h('button', { class: 'btn', type: 'button', hidden: true }, 'Swap without nutrition');
      const finish = (newIngredient) => close({ ...newIngredient, swappedFrom: ingredient.swappedFrom ?? ingredient });

      noNutritionBtn.addEventListener('click', () => {
        const p = parseIngredientLine(line.value);
        finish({ kind: 'food', name: s.name, brand: null, servings: 1, servingSize: p?.original ?? line.value, nutrients: {}, custom: {} });
      });

      const swap = async (ev) => {
        ev.preventDefault();
        const text = line.value.trim();
        if (!/\d|[¼½¾⅓⅔⅛]/.test(text)) {
          line.classList.add('invalid');
          errorBox.textContent = 'Add an amount, e.g. “2 medium zucchini” or “1 cup cauliflower rice”.';
          return;
        }
        swapBtn.disabled = true;
        swapBtn.textContent = 'Looking up nutrition…';
        errorBox.textContent = '';
        try {
          const result = await lookUpIngredient(text, { searchAs: s.search });
          if (!result.description || !result.grams) {
            errorBox.textContent = result.description
              ? `Found “${result.description}” but couldn’t work out the grams — check the amount, or swap without nutrition and add it later.`
              : 'No nutrition found for this substitute. You can swap without nutrition and add it later.';
            noNutritionBtn.hidden = false;
            swapBtn.disabled = false;
            swapBtn.textContent = 'Try again';
            return;
          }
          finish({ ...result.ingredient, name: s.name });
        } catch (err) {
          errorBox.textContent = err instanceof UsdaError ? err.message : 'The nutrition lookup failed.';
          noNutritionBtn.hidden = false;
          swapBtn.disabled = false;
          swapBtn.textContent = 'Try again';
        }
      };

      const form = h('form', { class: 'dialog-body', onSubmit: swap },
        h('h2', {}, `Use ${s.name.toLowerCase()}`),
        h('p', {}, 'Replacing: ', h('strong', {}, ingredient.servingSize ?? ingredient.name)),
        h('p', { class: 'muted' }, h('strong', {}, 'How: '), s.how),
        field('New ingredient', line, 'Adjust the amount if needed. Nutrition is looked up in the USDA database.'),
        errorBox,
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn btn-left', type: 'button', onClick: showList }, '‹ Back'),
          noNutritionBtn,
          swapBtn));
      mount(body, form);
      setTimeout(() => line.focus(), 0);
    };

    showList();
    return body;
  });
}

// "Swapped from all-purpose flour" line for an ingredient row.
export const swappedFromText = (ingredient) => (ingredient.swappedFrom ? `Swapped from ${ingredient.swappedFrom.name.toLowerCase()}` : '');
