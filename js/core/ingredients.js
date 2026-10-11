// Reads recipe text pasted from a website: ingredient lines like "1 ½ cups (200 g) flour, sifted",
// plus the recipe's name, servings, times and instructions.

// Measuring units. Mass and volume units have exact conversions; count units ("clove", "can")
// are converted with the food's own portion weights from the nutrition database.
export const UNITS = {
  g: { kind: 'mass', factor: 1, aliases: ['g', 'gram', 'grams', 'gr'] },
  kg: { kind: 'mass', factor: 1000, aliases: ['kg', 'kilogram', 'kilograms'] },
  oz: { kind: 'mass', factor: 28.3495, aliases: ['oz', 'ounce', 'ounces'] },
  lb: { kind: 'mass', factor: 453.592, aliases: ['lb', 'lbs', 'pound', 'pounds'] },
  ml: { kind: 'volume', factor: 1, aliases: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'] },
  l: { kind: 'volume', factor: 1000, aliases: ['l', 'liter', 'liters', 'litre', 'litres'] },
  tsp: { kind: 'volume', factor: 4.92892, aliases: ['tsp', 'tsps', 'teaspoon', 'teaspoons', 't'] },
  tbsp: { kind: 'volume', factor: 14.7868, aliases: ['tbsp', 'tbsps', 'tbs', 'tbl', 'tablespoon', 'tablespoons', 'T'] },
  cup: { kind: 'volume', factor: 236.588, aliases: ['cup', 'cups', 'c'] },
  floz: { kind: 'volume', factor: 29.5735, aliases: ['fl oz', 'fl. oz', 'fluid ounce', 'fluid ounces'] },
  pint: { kind: 'volume', factor: 473.176, aliases: ['pint', 'pints', 'pt'] },
  quart: { kind: 'volume', factor: 946.353, aliases: ['quart', 'quarts', 'qt'] },
  pinch: { kind: 'volume', factor: 0.31, aliases: ['pinch', 'pinches'] },
  dash: { kind: 'volume', factor: 0.62, aliases: ['dash', 'dashes'] },
  clove: { kind: 'count', aliases: ['clove', 'cloves'] },
  can: { kind: 'count', aliases: ['can', 'cans'] },
  slice: { kind: 'count', aliases: ['slice', 'slices'] },
  piece: { kind: 'count', aliases: ['piece', 'pieces'] },
  stick: { kind: 'count', aliases: ['stick', 'sticks'] },
  package: { kind: 'count', aliases: ['package', 'packages', 'pkg', 'packet', 'packets'] },
  bunch: { kind: 'count', aliases: ['bunch', 'bunches'] },
  head: { kind: 'count', aliases: ['head', 'heads'] },
  sprig: { kind: 'count', aliases: ['sprig', 'sprigs'] },
  stalk: { kind: 'count', aliases: ['stalk', 'stalks'] },
};

// Longest aliases first so "fl oz" wins over "oz" and "cups" over "c".
const ALIASES = Object.entries(UNITS)
  .flatMap(([key, u]) => u.aliases.map((alias) => ({ key, alias })))
  .sort((a, b) => b.alias.length - a.alias.length);

const FRACTIONS = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8 };
const FRACTION_CHARS = Object.keys(FRACTIONS).join('');

// One number: "1", "1.5", "1/2", "1 1/2", "1-1/2" (US recipes often hyphenate mixed numbers),
// "½", "1½", "1 ½".
const NUMBER = `(?:\\d+(?:\\.\\d+)?\\s*[${FRACTION_CHARS}]|\\d+(?:\\s+|-)\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.\\d+|\\d+|[${FRACTION_CHARS}])`;
// A quantity is one number or a range like "2-3" or "2 to 3" (the average is used).
const QUANTITY_RE = new RegExp(`^(${NUMBER})(?:\\s*(?:-|–|to)\\s*(${NUMBER}))?\\s*`);

function numberValue(text) {
  const s = text.replace(/\s+/g, ' ').trim();
  const fracChar = s.match(new RegExp(`^(\\d*)\\s*([${FRACTION_CHARS}])$`));
  if (fracChar) return Number(fracChar[1] || 0) + FRACTIONS[fracChar[2]];
  const mixed = s.match(/^(\d+)[ -](\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Bullets and the empty checkboxes many recipe sites put in front of ingredients.
const BULLETS_RE = /^[\s•·*\-–▢☐◻□○●▪︎✓✔]+/u;

// A weight in parentheses, e.g. "(15 oz)" or "(200 g)", gives the amount in grams directly.
const PAREN_MASS_RE = /\(\s*(\d+(?:\.\d+)?)\s*-?\s*(g|grams?|kg|oz|ounces?|lbs?|pounds?)\.?\s*\)/i;

function unitAt(text) {
  for (const { key, alias } of ALIASES) {
    // Single-letter aliases are case-sensitive (T = tablespoon, t = teaspoon) and need a space after.
    const caseSensitive = alias.length === 1;
    const head = text.slice(0, alias.length);
    const matches = caseSensitive ? head === alias : head.toLowerCase() === alias.toLowerCase();
    if (!matches) continue;
    const next = text.charAt(alias.length);
    if (next && !/[\s.,)]/.test(next)) continue;
    return { key, rest: text.slice(alias.length).replace(/^\.?\s*/, '') };
  }
  return null;
}

const massToGrams = (value, unitText) => {
  const u = unitText.toLowerCase();
  if (u.startsWith('kg')) return value * 1000;
  if (u.startsWith('g')) return value;
  if (u.startsWith('o')) return value * UNITS.oz.factor;
  return value * UNITS.lb.factor;
};

// Text copied from web pages often carries markdown-style links "[text](https://…)", bare URLs and
// footnote stars. Keep the link text, drop the addresses.
export function cleanPastedLine(line) {
  return String(line)
    .replace(/\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/(\S)\*+(?=\s|$)/g, '$1')
    .replace(/^\*+(?=\S)/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Words that start a preparation note after a comma ("onion, diced", "salt, to taste").
const PREP_NOTE_RE = /^(chopped|diced|minced|sliced|grated|shredded|crushed|pressed|peeled|seeded|cored|halved|quartered|cubed|julienned|trimmed|cut|torn|divided|drained|rinsed|softened|melted|beaten|whisked|sifted|packed|thawed|cooked|uncooked|at room temperature|room temperature|to taste|optional|for |plus |or |about |roughly|finely|thinly|coarsely|freshly|lightly|well|see |if |as needed|such as|preferably|patted|cleaned|stemmed|pitted|zested|juiced|toasted|warmed|chilled|cold|hot|boiled|mashed)/i;

// Size words that can come before a unit: "1 large can", "2 heaping tablespoons".
const SIZE_BEFORE_UNIT_RE = /^(small|medium|large|extra-large|heaping|heaped|level|scant|generous|rounded)\s+/i;

// Returns { original, quantity, unit, name, note, grams } or null for a blank line.
// quantity is null for amounts like "salt, to taste"; grams is set only when the line states a weight.
export function parseIngredientLine(line) {
  const original = cleanPastedLine(line.replace(BULLETS_RE, ''));
  if (!original) return null;
  let rest = original;
  let quantity = null;
  let unit = null;
  let grams = null;

  const q = rest.match(QUANTITY_RE);
  if (q) {
    const a = numberValue(q[1]);
    const b = q[2] ? numberValue(q[2]) : null;
    quantity = b != null ? (a + b) / 2 : a;
    rest = rest.slice(q[0].length);
  }

  // "1 (15 oz) can beans": the weight in parentheses is per unit.
  const paren = rest.match(PAREN_MASS_RE);
  if (paren && rest.indexOf(paren[0]) <= 1) {
    grams = massToGrams(Number(paren[1]), paren[2]) * (quantity ?? 1);
    rest = rest.replace(paren[0], '').trim();
  }

  let u = unitAt(rest);
  // "1 large can (28 ounces) tomatoes": look past the size word for the unit.
  const size = rest.match(SIZE_BEFORE_UNIT_RE);
  if (!u && size) {
    const afterSize = unitAt(rest.slice(size[0].length));
    if (afterSize) u = afterSize;
  }
  if (u) {
    unit = u.key;
    rest = u.rest;
  }
  rest = rest.replace(/^of\s+/i, '');

  // A weight given later in the line, e.g. "1 cup flour (125 g)".
  if (grams == null) {
    const later = rest.match(PAREN_MASS_RE);
    if (later) {
      grams = massToGrams(Number(later[1]), later[2]);
      rest = rest.replace(later[0], '').trim();
    }
  }
  if (grams == null && unit && UNITS[unit].kind === 'mass' && quantity != null) grams = quantity * UNITS[unit].factor;

  // The name ends where a preparation note starts: "garlic, minced" or "basil + more for garnish".
  // A comma inside the name stays: "low-moisture, part-skim mozzarella".
  let namePart = rest;
  let note = null;
  const plus = rest.search(/\s\+\s/);
  if (plus >= 0) {
    note = rest.slice(plus + 3).trim();
    namePart = rest.slice(0, plus);
  }
  const commas = [...namePart.matchAll(/,/g)].map((m) => m.index);
  const noteComma = commas.find((i) => PREP_NOTE_RE.test(namePart.slice(i + 1).trim()));
  if (noteComma != null) {
    note = [namePart.slice(noteComma + 1).trim(), note].filter(Boolean).join(', ');
    namePart = namePart.slice(0, noteComma);
  } else if (commas.length && !/\p{L}/u.test(namePart.slice(commas[commas.length - 1] + 1))) {
    namePart = namePart.slice(0, commas[commas.length - 1]);
  }
  const name = namePart.replace(/\([^)]*\)/g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  note ||= null;
  return { original, quantity, unit, name: name || original, note, grams };
}

// Recipe-site controls copied along with the text: scaling buttons ("1/2x", "1x 2x 3x") and
// unit toggles ("US Customary", "Metric").
const SITE_CONTROL_RE = /^(?:(?:\d+(?:\/\d+)?|[½¼¾])\s*x\s*)+$|^(?:us customary|metric|us|imperial)(?:\s*[|/]\s*(?:us customary|metric|us|imperial))*$/i;
export const isSiteControl = (line) => SITE_CONTROL_RE.test(line.replace(BULLETS_RE, '').trim());

// Lines that start with an amount look like ingredients.
const looksLikeIngredient = (line) => !isSiteControl(line) && QUANTITY_RE.test(line.replace(BULLETS_RE, '').trim());

// A real ingredient names a food: at least two letters once the amount and unit are removed.
const namesAFood = (ingredient) => /\p{L}{2,}/u.test(ingredient.name);

const INGREDIENTS_HEAD = /^ingredients?\s*:?$/i;
const STEPS_HEAD = /^(instructions?|directions?|method|preparation|steps?|how to make it)\s*:?$/i;
const NOTES_HEAD = /^(notes?|tips?|nutrition( facts| information)?)\s*:?$/i;
// Photo captions recipe sites put under each step, e.g. "Jane Doe / Food Stylist: …".
const PHOTO_CREDIT_RE = /\b(food stylist|prop stylist|photo(?:graph)? by|photo credit|image credit)\b/i;
const SERVINGS_RE =/\b(?:serves|servings?|yields?|makes)\b\s*:?\s*(\d+)/i;
const TIME_RE = (label) => new RegExp(`${label}\\s*time\\s*:?\\s*(?:(\\d+)\\s*(?:hours?|hrs?|h)\\s*)?(?:(\\d+)\\s*(?:minutes?|mins?|m))?`, 'i');

function minutesFrom(text, label) {
  const m = text.match(TIME_RE(label));
  if (!m || (!m[1] && !m[2])) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

// Amount-free lines that are still real ingredients ("black pepper, to taste").
const NO_AMOUNT_OK_RE = /\b(to taste|as needed|for garnish|for serving|for topping|optional|pinch|dash|handful|splash|drizzle)\b/i;

// Reads an ingredient list pasted into its own box: one ingredient per line. Section headings
// ("Veggies and spinach", "For the sauce:") and recipe-site controls are skipped.
export function parseIngredientList(text) {
  return String(text ?? '').split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !isSiteControl(l) && !INGREDIENTS_HEAD.test(l))
    .map(parseIngredientLine)
    .filter((i) => i && namesAFood(i) && (i.quantity != null || i.grams != null || NO_AMOUNT_OK_RE.test(i.original)) && !/:$/.test(i.original));
}

// Cleans pasted directions: removes web addresses, and drops lines that were only a link (ads such
// as "Sponsored by …" that land between steps) along with photo credits. Numbered steps are
// renumbered so removed lines don't leave gaps.
const STEP_NUMBER_RE = /^(\d+[.)]|step \d+:?)\s*/i;
export function cleanDirections(text) {
  const lines = String(text ?? '').split(/\r?\n/)
    .map((raw) => {
      const line = raw.trim();
      const withoutNumber = line.replace(STEP_NUMBER_RE, '');
      // A line that is nothing but a link: drop it.
      if (/^\[[^\]]*\]\((?:[^()]|\([^)]*\))*\)$/.test(withoutNumber) || /^https?:\/\/\S+$/.test(withoutNumber)) return '';
      return cleanPastedLine(line);
    })
    .filter((l) => l && !PHOTO_CREDIT_RE.test(l) && !STEPS_HEAD.test(l));
  const numbered = lines.filter((l) => STEP_NUMBER_RE.test(l)).length;
  if (numbered < lines.length / 2) return lines.join('\n');
  let n = 0;
  return lines.map((l) => (STEP_NUMBER_RE.test(l) ? `${++n}. ${l.replace(STEP_NUMBER_RE, '')}` : l)).join('\n');
}

export const cleanNotes = (text) => String(text ?? '').split(/\r?\n/).map(cleanPastedLine).filter(Boolean).join('\n');

// The recipe's creator, from lines like "Author: Jane Doe", "Recipe by Jane Doe",
// "Submitted by jdoe" or "Updated by Jane Doe on August 29, 2024".
const AUTHOR_RE = /^(?:author|recipe by|recipe from|written by|submitted by|created by|updated by|posted by|by)\s*:?\s+(.+?)(?:\s+(?:on|updated)\s+[A-Z][a-z]+\.? \d{1,2},? \d{4}.*)?$/i;
function findAuthor(lines) {
  for (const raw of lines) {
    const m = cleanPastedLine(raw.replace(BULLETS_RE, '')).match(AUTHOR_RE);
    if (m && m[1].length <= 80 && !/\d{3,}|review|photo/i.test(m[1])) return m[1].trim();
  }
  return '';
}

// Splits pasted recipe text into its parts. Works with or without "Ingredients" / "Instructions" headings.
export function parseRecipeText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !isSiteControl(l));
  const all = lines.join('\n');
  const servingsMatch = all.match(SERVINGS_RE);

  const ingIdx = lines.findIndex((l) => INGREDIENTS_HEAD.test(l));
  const stepIdx = lines.findIndex((l, i) => i > ingIdx && STEPS_HEAD.test(l));
  const isMeta = (l) => SERVINGS_RE.test(l) || /\btime\b/i.test(l) || NOTES_HEAD.test(l);
  // Sub-headings inside the list, like "For the sauce:".
  const isSubheading = (l) => /:$/.test(l) && !looksLikeIngredient(l);

  let ingredientLines;
  let stepLines;
  let headerLines;
  if (ingIdx >= 0) {
    const ingEnd = stepIdx >= 0 ? stepIdx : lines.length;
    headerLines = lines.slice(0, ingIdx);
    // Skip notes inside the list such as "Original recipe (1X) yields 24 servings".
    ingredientLines = lines.slice(ingIdx + 1, ingEnd).filter((l) => !isSubheading(l) && !NOTES_HEAD.test(l) && !isMeta(l));
    stepLines = stepIdx >= 0 ? lines.slice(stepIdx + 1) : [];
  } else {
    // No headings: the first run of amount-led lines is the ingredient list; what follows is the method.
    const first = lines.findIndex(looksLikeIngredient);
    let last = first;
    while (last + 1 < lines.length && (looksLikeIngredient(lines[last + 1]) || (!/[.!?]$/.test(lines[last + 1]) && lines[last + 1].length < 60))) last++;
    headerLines = first >= 0 ? lines.slice(0, first) : lines;
    ingredientLines = first >= 0 ? lines.slice(first, last + 1).filter((l) => !isSubheading(l)) : [];
    stepLines = first >= 0 ? lines.slice(last + 1) : [];
  }

  // Stop the method at a "Notes" or "Nutrition" section.
  const notesAt = stepLines.findIndex((l) => NOTES_HEAD.test(l));
  const notes = notesAt >= 0 ? stepLines.slice(notesAt + 1).join('\n') : '';
  if (notesAt >= 0) stepLines = stepLines.slice(0, notesAt);

  const name = cleanPastedLine(headerLines.find((l) => !isMeta(l) && l.length <= 100) ?? '');
  return {
    name,
    author: findAuthor(lines),
    yieldServings: servingsMatch ? Number(servingsMatch[1]) : null,
    prepMinutes: minutesFrom(all, 'prep(?:aration)?'),
    cookMinutes: minutesFrom(all, 'cook(?:ing)?'),
    // Same reading as the separate boxes: headings skipped, links and ads removed.
    ingredients: parseIngredientList(ingredientLines.join('\n')),
    ingredientsText: ingredientLines.filter((l) => !isSiteControl(l)).map(cleanPastedLine).join('\n'),
    instructions: cleanDirections(stepLines.join('\n')),
    notes: cleanNotes(notes),
  };
}
