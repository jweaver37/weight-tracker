// Built-in nutrients: every field on a US Nutrition Facts label, plus the optional vitamins and minerals.
// Values are stored per serving in the unit listed. `indent` mirrors the label's sub-rows.

export const NUTRIENTS = [
  { key: 'calories', label: 'Calories', unit: 'kcal', group: 'label', defaultVisible: true },
  { key: 'fat', label: 'Total Fat', unit: 'g', group: 'label', defaultVisible: true },
  { key: 'saturatedFat', label: 'Saturated Fat', unit: 'g', group: 'label', indent: 1 },
  { key: 'transFat', label: 'Trans Fat', unit: 'g', group: 'label', indent: 1 },
  { key: 'polyunsaturatedFat', label: 'Polyunsaturated Fat', unit: 'g', group: 'label', indent: 1 },
  { key: 'monounsaturatedFat', label: 'Monounsaturated Fat', unit: 'g', group: 'label', indent: 1 },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', group: 'label' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', group: 'label', defaultVisible: true },
  { key: 'carbs', label: 'Total Carbohydrate', unit: 'g', group: 'label', defaultVisible: true },
  { key: 'fiber', label: 'Dietary Fiber', unit: 'g', group: 'label', indent: 1, defaultVisible: true },
  { key: 'sugars', label: 'Total Sugars', unit: 'g', group: 'label', indent: 1, defaultVisible: true },
  { key: 'addedSugars', label: 'Added Sugars', unit: 'g', group: 'label', indent: 2 },
  { key: 'sugarAlcohol', label: 'Sugar Alcohol', unit: 'g', group: 'label', indent: 1 },
  { key: 'protein', label: 'Protein', unit: 'g', group: 'label', defaultVisible: true },

  { key: 'vitaminD', label: 'Vitamin D', unit: 'mcg', group: 'micro' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', group: 'micro' },
  { key: 'iron', label: 'Iron', unit: 'mg', group: 'micro' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', group: 'micro' },
  { key: 'vitaminA', label: 'Vitamin A', unit: 'mcg', group: 'micro' },
  { key: 'vitaminC', label: 'Vitamin C', unit: 'mg', group: 'micro' },
  { key: 'vitaminE', label: 'Vitamin E', unit: 'mg', group: 'micro' },
  { key: 'vitaminK', label: 'Vitamin K', unit: 'mcg', group: 'micro' },
  { key: 'thiamin', label: 'Thiamin (B1)', unit: 'mg', group: 'micro' },
  { key: 'riboflavin', label: 'Riboflavin (B2)', unit: 'mg', group: 'micro' },
  { key: 'niacin', label: 'Niacin (B3)', unit: 'mg', group: 'micro' },
  { key: 'vitaminB6', label: 'Vitamin B6', unit: 'mg', group: 'micro' },
  { key: 'folate', label: 'Folate', unit: 'mcg', group: 'micro' },
  { key: 'vitaminB12', label: 'Vitamin B12', unit: 'mcg', group: 'micro' },
  { key: 'biotin', label: 'Biotin', unit: 'mcg', group: 'micro' },
  { key: 'pantothenicAcid', label: 'Pantothenic Acid', unit: 'mg', group: 'micro' },
  { key: 'choline', label: 'Choline', unit: 'mg', group: 'micro' },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'mg', group: 'micro' },
  { key: 'iodine', label: 'Iodine', unit: 'mcg', group: 'micro' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', group: 'micro' },
  { key: 'zinc', label: 'Zinc', unit: 'mg', group: 'micro' },
  { key: 'selenium', label: 'Selenium', unit: 'mcg', group: 'micro' },
  { key: 'copper', label: 'Copper', unit: 'mg', group: 'micro' },
  { key: 'manganese', label: 'Manganese', unit: 'mg', group: 'micro' },
  { key: 'chromium', label: 'Chromium', unit: 'mcg', group: 'micro' },
  { key: 'molybdenum', label: 'Molybdenum', unit: 'mcg', group: 'micro' },
  { key: 'chloride', label: 'Chloride', unit: 'mg', group: 'micro' },
  { key: 'caffeine', label: 'Caffeine', unit: 'mg', group: 'micro' },
];

const BY_KEY = new Map(NUTRIENTS.map((n) => [n.key, n]));

export const nutrientByKey = (key) => BY_KEY.get(key);

export const DEFAULT_VISIBLE = NUTRIENTS.filter((n) => n.defaultVisible).map((n) => n.key);
