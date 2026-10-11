// Common ingredient substitutes, with the diets each suits and how much to use. Ratios are general
// kitchen guidelines (by volume, or per piece for eggs): baking especially can need adjusting.
// `ratio` scales the original amount; null means "see how" (amount varies).
// `search` is what to look up in the USDA database for the substitute's nutrition.

// Diet tags used across the list, in display order.
export const SWAP_TAGS = [
  { key: 'gluten-free', label: 'Gluten-Free' },
  { key: 'grain-free', label: 'Grain-Free' },
  { key: 'keto', label: 'Keto' },
  { key: 'low-carb', label: 'Low-Carb' },
  { key: 'paleo', label: 'Paleo' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'dairy-free', label: 'Dairy-Free' },
  { key: 'egg-free', label: 'Egg-Free' },
  { key: 'nut-free', label: 'Nut-Free' },
  { key: 'soy-free', label: 'Soy-Free' },
  { key: 'seed-oil-free', label: 'Seed-Oil Free' },
  { key: 'high-protein', label: 'High-Protein' },
  { key: 'high-fiber', label: 'High-Fiber' },
  { key: 'lower-calorie', label: 'Lower-Calorie' },
  { key: 'lower-fat', label: 'Lower-Fat' },
  { key: 'lower-sugar', label: 'Lower-Sugar' },
  { key: 'lower-sodium', label: 'Lower-Sodium' },
  { key: 'whole-food', label: 'Whole-Food' },
];

const sub = (name, what, tags, ratio, how, search = name, per = null) => ({ name, what, tags, ratio, how, search, per });
// Amount per counted original (e.g. per egg): { quantity, unit, name } — name is what goes on the line.
const per = (quantity, unit, name) => ({ quantity, unit, name });

// Each group: `match` words that identify the ingredient (most specific groups first), `not`
// words that rule it out, and the substitutes.
export const SUBSTITUTE_GROUPS = [
  {
    key: 'flour', label: 'all-purpose flour', match: ['all-purpose flour', 'all purpose flour', 'plain flour', 'white flour', 'wheat flour', 'bread flour', 'cake flour', 'flour'],
    not: ['almond flour', 'coconut flour', 'oat flour', 'cassava flour', 'chickpea flour', 'buckwheat flour', 'rice flour', 'tortilla'],
    subs: [
      sub('Almond flour', 'Finely ground blanched almonds.', ['gluten-free', 'grain-free', 'keto', 'low-carb', 'paleo', 'vegan', 'dairy-free'], 1,
        'About 1:1 by volume. It won’t rise like wheat flour — best in cookies, quick breads and coatings; an extra egg can help it hold together.'),
      sub('Coconut flour', 'Dried, ground coconut meat — very high in fiber and absorbs a lot of liquid.', ['gluten-free', 'grain-free', 'keto', 'low-carb', 'paleo', 'nut-free', 'high-fiber'], 0.25,
        'Use only about ¼ cup per 1 cup of flour, and add 1 extra egg (or ¼ cup more liquid) for each ¼ cup used.'),
      sub('Oat flour', 'Finely ground rolled oats.', ['gluten-free', 'vegetarian', 'vegan', 'whole-food', 'high-fiber'], 1.33,
        'Use about 1⅓ cups per 1 cup of flour. Gluten-free only if the oats are certified gluten-free.'),
      sub('Cassava flour', 'The ground, whole root of the cassava plant.', ['gluten-free', 'grain-free', 'paleo', 'nut-free', 'vegan'], 1,
        'Closest gluten-free match to wheat flour. Start with 1:1, or a little less (about ¾ cup per cup) if the batter seems thick.'),
      sub('Chickpea flour', 'Ground dried chickpeas (also called garbanzo or gram flour).', ['gluten-free', 'vegetarian', 'vegan', 'high-protein', 'high-fiber'], 1,
        '1:1 in batters, fritters and flatbreads. In cakes and breads, replace up to half the flour — it has a strong, beany taste.', 'chickpea flour'),
      sub('Buckwheat flour', 'Made from a pseudo-cereal seed — despite the name, it’s wheat-free.', ['gluten-free', 'vegetarian', 'vegan', 'whole-food', 'high-fiber'], 1,
        '1:1 in pancakes and crepes. In baking, replace up to half the flour — it’s dense and earthy.'),
      sub('Spelt flour', 'An ancient grain related to wheat. Note: it still contains gluten, so it is not gluten-free.', ['whole-food', 'vegetarian', 'vegan'], 1,
        'About 1:1; you may need a little less liquid.', 'spelt flour'),
      sub('Whole-wheat flour', 'Flour milled from the whole wheat kernel (contains gluten).', ['whole-food', 'high-fiber', 'vegetarian', 'vegan'], 1,
        '1:1, or replace half for a lighter texture.', 'whole wheat flour'),
      sub('Gluten-free 1-to-1 flour blend', 'A store-bought mix of rice flour, starches and a binder.', ['gluten-free', 'vegetarian', 'vegan'], 1,
        '1:1 — look for blends labeled “cup for cup” or “1-to-1”.', 'rice flour'),
    ],
  },
  {
    key: 'brownSugar', label: 'brown sugar', match: ['brown sugar'],
    subs: [
      sub('Coconut sugar', 'Granulated sap of the coconut palm, with a caramel taste.', ['paleo', 'vegan', 'whole-food'], 1, '1:1.'),
      sub('White sugar plus molasses', 'Make your own: 1 cup white sugar + 1 tablespoon molasses.', ['vegan'], 1, '1:1 once mixed.', 'sugar'),
      sub('Brown monk fruit or erythritol blend', 'Zero-calorie sweetener made to replace brown sugar.', ['keto', 'low-carb', 'lower-calorie', 'lower-sugar', 'vegan'], 1,
        '1:1 for blends labeled as a brown sugar replacement — check the package.', 'erythritol'),
    ],
  },
  {
    key: 'sugar', label: 'sugar', match: ['white sugar', 'granulated sugar', 'cane sugar', 'sugar'],
    not: ['brown sugar', 'powdered sugar', 'confectioners', 'coconut sugar', 'sugar-free', 'sugar free'],
    subs: [
      sub('Honey', 'Natural sweetener — sweeter than sugar.', ['paleo', 'vegetarian', 'whole-food'], 0.75,
        'Use ¾ cup per 1 cup of sugar, reduce other liquid by about 3 tablespoons, and bake 25°F lower. Not vegan.'),
      sub('Maple syrup', 'Boiled-down maple tree sap.', ['paleo', 'vegan', 'whole-food'], 0.75,
        'Use ¾ cup per 1 cup of sugar and reduce other liquid by about 3 tablespoons.'),
      sub('Coconut sugar', 'Granulated sap of the coconut palm.', ['paleo', 'vegan', 'whole-food'], 1, '1:1.'),
      sub('Monk fruit or erythritol blend', 'Zero-calorie sweetener made to measure like sugar.', ['keto', 'low-carb', 'lower-calorie', 'lower-sugar', 'vegan'], 1,
        '1:1 for “cup for cup” blends — check the package.', 'erythritol'),
      sub('Unsweetened applesauce', 'Puréed apples — adds moisture and some sweetness.', ['lower-calorie', 'lower-sugar', 'vegan', 'whole-food'], 1,
        'Replace up to half the sugar with an equal amount of applesauce, and reduce other liquid by about ¼ cup per cup.', 'applesauce unsweetened'),
      sub('Mashed ripe banana', 'Very ripe banana, mashed.', ['lower-sugar', 'vegan', 'paleo', 'whole-food'], 0.5,
        'Use about ½ cup mashed banana per 1 cup of sugar in quick breads and muffins.', 'banana'),
    ],
  },
  {
    key: 'honey', label: 'honey', match: ['honey'],
    subs: [
      sub('Maple syrup', 'Boiled-down maple tree sap.', ['vegan', 'paleo', 'whole-food'], 1, '1:1.'),
      sub('Agave syrup', 'Sweet syrup from the agave plant — a little sweeter than honey.', ['vegan'], 1, '1:1, or slightly less.', 'agave'),
      sub('Date syrup', 'Syrup made from cooked dates.', ['vegan', 'paleo', 'whole-food'], 1, '1:1.', 'dates'),
    ],
  },
  {
    key: 'butter', label: 'butter', match: ['unsalted butter', 'salted butter', 'butter'],
    not: ['peanut butter', 'almond butter', 'nut butter', 'apple butter', 'cocoa butter', 'butternut', 'buttermilk', 'butter bean', 'vegan butter'],
    subs: [
      sub('Coconut oil', 'Oil pressed from coconut — solid when cool, like butter.', ['vegan', 'dairy-free', 'paleo', 'keto', 'seed-oil-free'], 1,
        '1:1 (use it solid where the recipe uses cold butter, melted where it uses melted). Adds a light coconut taste unless refined.'),
      sub('Olive oil', 'Liquid oil pressed from olives.', ['vegan', 'dairy-free', 'paleo', 'keto', 'seed-oil-free'], 0.75,
        'Use ¾ cup per 1 cup of butter. Best for cooking and savory baking.'),
      sub('Vegan butter', 'Plant-based butter made to replace dairy butter (most brands contain seed oils).', ['vegan', 'dairy-free'], 1, '1:1.', 'margarine'),
      sub('Mashed avocado', 'Ripe avocado, mashed smooth.', ['vegan', 'dairy-free', 'paleo', 'whole-food', 'seed-oil-free'], 1,
        '1:1 in brownies and quick breads. Results are softer and denser.', 'avocado'),
      sub('Unsweetened applesauce', 'Puréed apples.', ['vegan', 'dairy-free', 'lower-fat', 'lower-calorie', 'seed-oil-free'], 0.5,
        'Replace up to half the butter, using about half as much applesauce. Best in muffins and quick breads.', 'applesauce unsweetened'),
      sub('Plain Greek yogurt', 'Thick, strained yogurt.', ['vegetarian', 'high-protein', 'lower-fat', 'lower-calorie', 'seed-oil-free'], 0.5,
        'Use about ½ cup yogurt per 1 cup of butter in baking. Not dairy-free.', 'greek yogurt plain'),
    ],
  },
  {
    key: 'oil', label: 'oil',
    match: ['vegetable oil', 'canola oil', 'rapeseed oil', 'corn oil', 'soybean oil', 'sunflower oil', 'safflower oil', 'grapeseed oil',
      'rice bran oil', 'cottonseed oil', 'cooking oil', 'neutral oil', 'frying oil'],
    subs: [
      sub('Avocado oil', 'Mild oil pressed from avocados — high smoke point, good for frying.', ['paleo', 'keto', 'vegan', 'seed-oil-free'], 1, '1:1.'),
      sub('Melted coconut oil', 'Coconut oil, melted.', ['paleo', 'keto', 'vegan', 'seed-oil-free'], 1, '1:1; let other ingredients reach room temperature so it doesn’t re-solidify.', 'coconut oil'),
      sub('Light olive oil', 'Mild-tasting olive oil.', ['paleo', 'keto', 'vegan', 'seed-oil-free'], 1, '1:1.', 'olive oil'),
      sub('Melted butter or ghee', 'Butter, or ghee (clarified butter) for higher heat.', ['keto', 'vegetarian', 'seed-oil-free'], 1, '1:1 in baking and sautéing.', 'butter'),
      sub('Unsweetened applesauce', 'Puréed apples.', ['lower-fat', 'lower-calorie', 'vegan', 'whole-food', 'seed-oil-free'], 1,
        '1:1 in baking (or replace half the oil for a closer texture).', 'applesauce unsweetened'),
    ],
  },
  {
    key: 'egg', label: 'egg', match: ['egg', 'eggs'],
    not: ['eggplant', 'egg white', 'egg yolk', 'egg noodle', 'flax egg', 'chia egg', 'egg replacer'],
    subs: [
      sub('Flax egg', '1 tablespoon ground flaxseed + 3 tablespoons water, rested 5 minutes.', ['vegan', 'egg-free', 'paleo', 'high-fiber'], null,
        'Per egg: 1 tablespoon ground flaxseed + 3 tablespoons water. Works in muffins, cookies and pancakes.', 'flaxseed', per(1, 'tbsp', 'ground flaxseed (plus 3 tbsp water each)')),
      sub('Chia egg', '1 tablespoon chia seeds + 3 tablespoons water, rested 5 minutes.', ['vegan', 'egg-free', 'paleo', 'high-fiber'], null,
        'Per egg: 1 tablespoon chia seeds + 3 tablespoons water.', 'chia seeds', per(1, 'tbsp', 'chia seeds (plus 3 tbsp water each)')),
      sub('Unsweetened applesauce', 'Puréed apples.', ['vegan', 'egg-free', 'lower-fat'], null, 'Per egg: ¼ cup applesauce. Best in sweet bakes.', 'applesauce unsweetened', per(0.25, 'cup', 'unsweetened applesauce')),
      sub('Mashed banana', 'Ripe banana, mashed.', ['vegan', 'egg-free', 'paleo'], null, 'Per egg: ¼ cup mashed banana. Adds banana flavor.', 'banana', per(0.25, 'cup', 'mashed banana')),
      sub('Aquafaba', 'The liquid from a can of chickpeas — whips like egg white.', ['vegan', 'egg-free', 'lower-calorie'], null,
        'Per egg: 3 tablespoons aquafaba (2 tablespoons per egg white).', 'chickpeas canned liquid', per(3, 'tbsp', 'aquafaba')),
      sub('Silken tofu', 'Smooth, soft tofu, blended.', ['vegan', 'egg-free', 'high-protein'], null, 'Per egg: ¼ cup blended silken tofu. Good in dense bakes and quiches.', 'tofu silken', per(0.25, 'cup', 'silken tofu, blended')),
    ],
  },
  {
    key: 'heavyCream', label: 'heavy cream', match: ['heavy cream', 'whipping cream', 'heavy whipping cream', 'double cream'],
    subs: [
      sub('Full-fat coconut milk', 'Canned coconut milk (the thick cream on top whips).', ['vegan', 'dairy-free', 'keto', 'paleo'], 1, '1:1 in soups and sauces.', 'coconut milk canned'),
      sub('Half-and-half', 'Equal parts milk and cream.', ['lower-fat', 'lower-calorie', 'vegetarian'], 1, '1:1 in sauces and coffee; it won’t whip.'),
      sub('Evaporated milk', 'Milk with about half its water removed.', ['lower-fat', 'lower-calorie', 'vegetarian'], 1, '1:1 in soups and sauces; it won’t whip.'),
      sub('Cashew cream', 'Soaked cashews blended with water until smooth.', ['vegan', 'dairy-free', 'paleo'], 1, '1:1 in soups and sauces.', 'cashews'),
    ],
  },
  {
    key: 'milk', label: 'milk', match: ['whole milk', '2% milk', 'skim milk', 'milk'],
    not: ['almond milk', 'oat milk', 'soy milk', 'coconut milk', 'rice milk', 'cashew milk', 'buttermilk', 'condensed milk', 'evaporated milk', 'milk chocolate'],
    subs: [
      sub('Unsweetened almond milk', 'Plant milk from almonds — very low in calories.', ['vegan', 'dairy-free', 'paleo', 'lower-calorie', 'keto', 'low-carb'], 1, '1:1.', 'almond milk unsweetened'),
      sub('Oat milk', 'Plant milk from oats — creamy, good for baking.', ['vegan', 'dairy-free', 'nut-free'], 1, '1:1.', 'oat milk'),
      sub('Soy milk', 'Plant milk from soybeans — closest to dairy milk in protein.', ['vegan', 'dairy-free', 'nut-free', 'high-protein'], 1, '1:1.', 'soymilk'),
      sub('Coconut milk beverage', 'Thin coconut milk sold in cartons.', ['vegan', 'dairy-free', 'nut-free', 'paleo'], 1, '1:1.', 'coconut milk beverage'),
      sub('Skim milk', 'Fat-free cow’s milk.', ['lower-fat', 'lower-calorie', 'vegetarian'], 1, '1:1.', 'milk nonfat'),
    ],
  },
  {
    key: 'sourCream', label: 'sour cream', match: ['sour cream'],
    subs: [
      sub('Plain Greek yogurt', 'Thick, strained yogurt.', ['high-protein', 'lower-fat', 'lower-calorie', 'vegetarian'], 1, '1:1.', 'greek yogurt plain'),
      sub('Cashew cream', 'Soaked cashews blended with lemon juice and water.', ['vegan', 'dairy-free', 'paleo'], 1, '1:1.', 'cashews'),
      sub('Coconut yogurt', 'Yogurt made from coconut milk.', ['vegan', 'dairy-free', 'paleo'], 1, '1:1.', 'coconut yogurt'),
      sub('Blended cottage cheese', 'Cottage cheese blended until smooth.', ['high-protein', 'lower-fat', 'vegetarian'], 1, '1:1.', 'cottage cheese'),
    ],
  },
  {
    key: 'yogurt', label: 'yogurt', match: ['greek yogurt', 'yogurt'],
    not: ['coconut yogurt', 'soy yogurt', 'frozen yogurt'],
    subs: [
      sub('Coconut yogurt', 'Yogurt made from coconut milk.', ['vegan', 'dairy-free', 'paleo'], 1, '1:1.', 'coconut yogurt'),
      sub('Sour cream', 'Cultured cream.', ['vegetarian', 'keto'], 1, '1:1 — richer and higher in fat.'),
      sub('Blended silken tofu', 'Silken tofu blended with a little lemon juice.', ['vegan', 'dairy-free', 'high-protein'], 1, '1:1.', 'tofu silken'),
    ],
  },
  {
    key: 'creamCheese', label: 'cream cheese', match: ['cream cheese'],
    not: ['vegan cream cheese'],
    subs: [
      sub('Neufchâtel cheese', 'A softer cheese with about a third less fat than cream cheese.', ['lower-fat', 'lower-calorie', 'vegetarian'], 1, '1:1.', 'neufchatel cheese'),
      sub('Blended cottage cheese', 'Cottage cheese blended until smooth.', ['high-protein', 'lower-fat', 'vegetarian'], 1, '1:1 in dips and spreads.', 'cottage cheese'),
      sub('Vegan cream cheese', 'Plant-based spread made from nuts or soy.', ['vegan', 'dairy-free'], 1, '1:1.', 'tofu'),
      sub('Strained Greek yogurt', 'Greek yogurt drained overnight in a cloth.', ['high-protein', 'lower-fat', 'vegetarian'], 1, '1:1 in dips and frostings.', 'greek yogurt plain'),
    ],
  },
  {
    key: 'mayo', label: 'mayonnaise', match: ['mayonnaise', 'mayo'],
    not: ['vegan mayo'],
    subs: [
      sub('Plain Greek yogurt', 'Thick, strained yogurt.', ['high-protein', 'lower-fat', 'lower-calorie', 'vegetarian', 'egg-free', 'seed-oil-free'], 1, '1:1 in salads and dressings; add a squeeze of lemon.', 'greek yogurt plain'),
      sub('Mashed avocado', 'Ripe avocado, mashed smooth.', ['vegan', 'dairy-free', 'egg-free', 'paleo', 'whole-food', 'seed-oil-free'], 1, '1:1 in sandwiches and salads.', 'avocado'),
      sub('Avocado oil mayo', 'Mayonnaise made with avocado oil instead of soybean or canola oil.', ['paleo', 'keto', 'seed-oil-free'], 1, '1:1.', 'mayonnaise'),
      sub('Vegan mayo', 'Egg-free mayonnaise, often made with aquafaba and oil (usually a seed oil).', ['vegan', 'egg-free', 'dairy-free'], 1, '1:1.', 'mayonnaise'),
      sub('Hummus', 'Chickpea and tahini spread.', ['vegan', 'egg-free', 'dairy-free', 'high-fiber'], 1, '1:1 on sandwiches and wraps.'),
    ],
  },
  {
    key: 'cheese', label: 'cheese', match: ['cheddar', 'mozzarella', 'shredded cheese', 'monterey jack', 'colby', 'swiss cheese', 'provolone', 'cheese'],
    not: ['cream cheese', 'cottage cheese', 'vegan cheese', 'parmesan', 'feta', 'ricotta', 'goat cheese'],
    subs: [
      sub('Nutritional yeast', 'Deactivated yeast flakes with a savory, cheesy taste.', ['vegan', 'dairy-free', 'gluten-free', 'high-protein', 'lower-fat'], 0.25,
        'For flavor, use about ¼ as much (it won’t melt). Great on pasta and popcorn.', 'nutritional yeast'),
      sub('Vegan cheese shreds', 'Plant-based cheese made to melt.', ['vegan', 'dairy-free'], 1, '1:1.', 'cheese substitute'),
      sub('Part-skim mozzarella', 'Mozzarella made with partly skimmed milk.', ['lower-fat', 'lower-calorie', 'vegetarian'], 1, '1:1.', 'mozzarella part skim'),
      sub('Reduced-fat cheddar', 'Cheddar with less fat.', ['lower-fat', 'lower-calorie', 'vegetarian'], 1, '1:1.', 'cheddar cheese reduced fat'),
    ],
  },
  {
    key: 'parmesan', label: 'parmesan', match: ['parmesan', 'parmigiano', 'pecorino'],
    subs: [
      sub('Nutritional yeast', 'Deactivated yeast flakes with a savory, cheesy taste.', ['vegan', 'dairy-free', 'gluten-free', 'high-protein'], 1, '1:1 for sprinkling.', 'nutritional yeast'),
      sub('Ground cashews with nutritional yeast', 'A vegan “parmesan” of blitzed cashews, nutritional yeast and salt.', ['vegan', 'dairy-free', 'paleo'], 1, '1:1 for sprinkling.', 'cashews'),
    ],
  },
  {
    key: 'pasta', label: 'pasta', match: ['spaghetti', 'penne', 'rigatoni', 'fettuccine', 'linguine', 'macaroni', 'lasagna noodles', 'lasagna noodle', 'egg noodles', 'pasta', 'noodles'],
    not: ['rice noodles', 'zucchini noodles', 'chickpea pasta', 'lentil pasta', 'shirataki', 'spaghetti squash'],
    subs: [
      sub('Zucchini noodles', 'Zucchini cut into noodle-like strands.', ['gluten-free', 'grain-free', 'keto', 'low-carb', 'paleo', 'lower-calorie', 'vegan', 'whole-food'], null,
        'About 1 medium zucchini per serving of pasta. Cook briefly so they don’t go soggy.', 'zucchini'),
      sub('Spaghetti squash', 'Roasted squash that pulls into strands.', ['gluten-free', 'grain-free', 'paleo', 'low-carb', 'lower-calorie', 'vegan', 'whole-food'], null,
        'About 1 cup cooked squash per serving of pasta.', 'spaghetti squash'),
      sub('Chickpea or lentil pasta', 'Pasta made from bean flour.', ['gluten-free', 'high-protein', 'high-fiber', 'vegan'], 1, '1:1.', 'chickpea pasta'),
      sub('Whole-wheat pasta', 'Pasta made from whole-wheat flour.', ['whole-food', 'high-fiber', 'vegan'], 1, '1:1.', 'whole wheat spaghetti'),
      sub('Shirataki noodles', 'Very low-calorie noodles made from konjac root.', ['keto', 'low-carb', 'gluten-free', 'lower-calorie', 'vegan'], null,
        'About 1 package per serving. Rinse well before cooking.', 'konjac'),
    ],
  },
  {
    key: 'rice', label: 'rice', match: ['white rice', 'long-grain rice', 'jasmine rice', 'basmati rice', 'rice'],
    not: ['rice flour', 'rice noodles', 'rice vinegar', 'rice milk', 'cauliflower rice', 'brown rice', 'wild rice', 'rice cakes', 'rice paper'],
    subs: [
      sub('Cauliflower rice', 'Cauliflower chopped into rice-sized pieces.', ['keto', 'low-carb', 'paleo', 'grain-free', 'gluten-free', 'lower-calorie', 'vegan', 'whole-food'], 1,
        '1:1 by cooked volume. Cooks in about 5 minutes.', 'cauliflower'),
      sub('Brown rice', 'Whole-grain rice with the bran left on.', ['whole-food', 'high-fiber', 'vegan', 'gluten-free'], 1, '1:1, but it takes about twice as long to cook.'),
      sub('Quinoa', 'A protein-rich seed cooked like a grain.', ['gluten-free', 'high-protein', 'high-fiber', 'vegan', 'whole-food'], 1, '1:1; cooks in about 15 minutes.'),
      sub('Riced broccoli', 'Broccoli chopped into rice-sized pieces.', ['keto', 'low-carb', 'paleo', 'lower-calorie', 'vegan', 'whole-food'], 1, '1:1 by cooked volume.', 'broccoli'),
    ],
  },
  {
    key: 'potato', label: 'potatoes', match: ['russet potatoes', 'potatoes', 'potato'],
    not: ['sweet potato', 'potato chips', 'potato starch'],
    subs: [
      sub('Cauliflower', 'Steamed and mashed or roasted cauliflower.', ['keto', 'low-carb', 'paleo', 'lower-calorie', 'vegan', 'whole-food'], 1, '1:1 by weight — great mashed.', 'cauliflower'),
      sub('Sweet potatoes', 'Orange-fleshed sweet potatoes.', ['paleo', 'whole-food', 'high-fiber', 'vegan'], 1, '1:1.', 'sweet potato'),
      sub('Turnips or rutabaga', 'Root vegetables with a mild, peppery taste.', ['low-carb', 'keto', 'paleo', 'lower-calorie', 'vegan'], 1, '1:1 — good roasted or in stews.', 'turnips'),
    ],
  },
  {
    key: 'tortilla', label: 'tortillas', match: ['flour tortillas', 'flour tortilla', 'tortillas', 'tortilla', 'wraps'],
    not: ['corn tortilla', 'tortilla chips', 'lettuce wraps'],
    subs: [
      sub('Lettuce wraps', 'Large lettuce leaves such as butter or romaine.', ['keto', 'low-carb', 'paleo', 'gluten-free', 'lower-calorie', 'vegan', 'whole-food'], null, '1–2 large leaves per tortilla.', 'lettuce'),
      sub('Corn tortillas', 'Tortillas made from corn masa.', ['gluten-free', 'vegan', 'lower-calorie'], 1, '1:1 (they’re smaller — warm them so they don’t crack).', 'corn tortillas'),
      sub('Whole-wheat tortillas', 'Tortillas made from whole-wheat flour.', ['whole-food', 'high-fiber', 'vegan'], 1, '1:1.', 'whole wheat tortillas'),
      sub('Low-carb tortillas', 'High-fiber tortillas made for low-carb diets.', ['low-carb', 'keto', 'high-fiber'], 1, '1:1.', 'tortillas low carb'),
    ],
  },
  {
    key: 'bread', label: 'bread', match: ['white bread', 'sandwich bread', 'bread', 'buns', 'bun', 'rolls'],
    not: ['breadcrumbs', 'bread crumbs', 'panko', 'cornbread', 'bread flour'],
    subs: [
      sub('Whole-grain bread', 'Bread made with whole-grain flour.', ['whole-food', 'high-fiber', 'vegan'], 1, '1:1.', 'whole wheat bread'),
      sub('Sprouted-grain bread', 'Bread made from sprouted whole grains.', ['whole-food', 'high-fiber', 'high-protein'], 1, '1:1.', 'sprouted wheat bread'),
      sub('Gluten-free bread', 'Bread made without wheat, barley or rye.', ['gluten-free'], 1, '1:1.', 'gluten free bread'),
      sub('Lettuce wraps', 'Large lettuce leaves.', ['keto', 'low-carb', 'paleo', 'gluten-free', 'lower-calorie', 'vegan'], null, '1–2 large leaves per slice or bun.', 'lettuce'),
    ],
  },
  {
    key: 'breadcrumbs', label: 'breadcrumbs', match: ['breadcrumbs', 'bread crumbs', 'panko'],
    subs: [
      sub('Almond flour', 'Finely ground blanched almonds.', ['gluten-free', 'grain-free', 'keto', 'low-carb', 'paleo'], 1, '1:1 for coating and binding.'),
      sub('Rolled oats', 'Old-fashioned oats (pulse for a finer crumb).', ['whole-food', 'high-fiber', 'vegan', 'gluten-free'], 1, '1:1 in meatballs and meatloaf. Gluten-free only if certified.', 'oats'),
      sub('Crushed pork rinds', 'Fried pork skin, crushed.', ['keto', 'low-carb', 'gluten-free', 'grain-free'], 1, '1:1 for coatings. Not vegetarian.', 'pork skins'),
      sub('Gluten-free breadcrumbs', 'Breadcrumbs made from gluten-free bread.', ['gluten-free'], 1, '1:1.', 'gluten free bread'),
    ],
  },
  {
    key: 'groundBeef', label: 'ground beef', match: ['ground beef', 'hamburger meat', 'ground chuck', 'minced beef'],
    subs: [
      sub('Ground turkey', 'Lean ground turkey.', ['lower-fat', 'lower-calorie', 'high-protein'], 1, '1:1 by weight. Add a little oil — it’s leaner.', 'ground turkey 93% lean'),
      sub('Lentils', 'Cooked brown or green lentils.', ['vegan', 'vegetarian', 'high-fiber', 'lower-fat', 'whole-food'], null,
        'About 1½ cups cooked lentils per pound of ground beef.', 'lentils cooked'),
      sub('Finely chopped mushrooms', 'Mushrooms chopped small and browned.', ['vegan', 'vegetarian', 'lower-calorie', 'keto', 'paleo', 'whole-food'], null,
        'Replace half the beef with an equal weight of mushrooms, or all of it for a vegetarian dish.', 'mushrooms'),
      sub('Plant-based ground', 'Meat-free “ground beef” from soy or pea protein.', ['vegan', 'vegetarian', 'high-protein'], 1, '1:1 by weight.', 'meatless crumbles'),
      sub('Crumbled tempeh', 'Fermented soybean cake, crumbled.', ['vegan', 'vegetarian', 'high-protein', 'high-fiber'], 1, '1:1 by weight.', 'tempeh'),
    ],
  },
  {
    key: 'chicken', label: 'chicken', match: ['chicken breast', 'chicken breasts', 'chicken thighs', 'chicken'],
    not: ['chicken broth', 'chicken stock', 'chicken bouillon'],
    subs: [
      sub('Extra-firm tofu', 'Pressed, extra-firm tofu.', ['vegan', 'vegetarian', 'high-protein', 'lower-fat'], 1, '1:1 by weight. Press out the water first.', 'tofu firm'),
      sub('Chickpeas', 'Cooked chickpeas.', ['vegan', 'vegetarian', 'high-fiber', 'whole-food'], null, 'About 1½ cups cooked chickpeas per pound of chicken.', 'chickpeas canned'),
      sub('Turkey breast', 'Lean turkey breast.', ['lower-fat', 'high-protein'], 1, '1:1 by weight.', 'turkey breast'),
      sub('Jackfruit', 'Young green jackfruit — shreds like pulled chicken.', ['vegan', 'vegetarian', 'lower-calorie'], 1, '1:1 by weight in shredded dishes.', 'jackfruit'),
    ],
  },
  {
    key: 'soySauce', label: 'soy sauce', match: ['soy sauce', 'shoyu'],
    subs: [
      sub('Tamari', 'Japanese soy sauce usually made without wheat.', ['gluten-free', 'vegan'], 1, '1:1 — check the label for gluten-free.', 'tamari'),
      sub('Coconut aminos', 'Sweet-salty sauce from coconut sap.', ['soy-free', 'gluten-free', 'paleo', 'lower-sodium', 'vegan'], 1, '1:1 (it’s a little sweeter).', 'coconut aminos'),
      sub('Low-sodium soy sauce', 'Soy sauce with about 40% less sodium.', ['lower-sodium', 'vegan'], 1, '1:1.', 'soy sauce low sodium'),
    ],
  },
  {
    key: 'cornstarch', label: 'cornstarch', match: ['cornstarch', 'corn starch', 'cornflour'],
    subs: [
      sub('Arrowroot powder', 'Starch from the arrowroot plant.', ['paleo', 'gluten-free', 'grain-free', 'vegan'], 1, '1:1. Add near the end of cooking — long heat thins it.', 'arrowroot'),
      sub('Tapioca starch', 'Starch from the cassava root.', ['paleo', 'gluten-free', 'grain-free', 'vegan'], 2, 'Use 2 tablespoons per 1 tablespoon cornstarch.', 'tapioca'),
      sub('All-purpose flour', 'Wheat flour (contains gluten).', ['vegan'], 2, 'Use 2 tablespoons per 1 tablespoon cornstarch.', 'wheat flour all-purpose'),
    ],
  },
  {
    key: 'chocolateChips', label: 'chocolate chips', match: ['chocolate chips', 'chocolate chip', 'chocolate morsels'],
    subs: [
      sub('Dark chocolate (70%+)', 'Chopped dark chocolate — less sugar.', ['lower-sugar', 'vegan'], 1, '1:1. Check the label — some contain milk.', 'chocolate dark 70'),
      sub('Cacao nibs', 'Crushed roasted cacao beans — crunchy and unsweetened.', ['lower-sugar', 'keto', 'paleo', 'vegan', 'dairy-free'], 1, '1:1 (they’re bitter, not sweet).', 'cocoa beans'),
      sub('Sugar-free chocolate chips', 'Chips sweetened with stevia or erythritol.', ['keto', 'low-carb', 'lower-sugar'], 1, '1:1.', 'chocolate sugar free'),
      sub('Carob chips', 'Chips made from the carob pod — caffeine-free.', ['vegan', 'dairy-free'], 1, '1:1 (milder, less chocolatey).', 'carob'),
    ],
  },
  {
    key: 'peanutButter', label: 'peanut butter', match: ['peanut butter'],
    subs: [
      sub('Almond butter', 'Ground roasted almonds.', ['paleo', 'vegan'], 1, '1:1.'),
      sub('Sunflower seed butter', 'Ground roasted sunflower seeds.', ['nut-free', 'vegan', 'paleo'], 1, '1:1 (it can turn green in baking — harmless).', 'sunflower seed butter'),
      sub('Tahini', 'Ground sesame seeds.', ['nut-free', 'vegan', 'paleo', 'keto'], 1, '1:1 in sauces and dressings.'),
      sub('Powdered peanut butter', 'Peanut butter with most of the oil pressed out, mixed with water.', ['lower-fat', 'lower-calorie', 'high-protein', 'vegan'], null,
        'About 2 tablespoons powder + 1 tablespoon water per 1 tablespoon peanut butter.', 'peanut flour defatted'),
    ],
  },
];

const wordIn = (text, phrase) => new RegExp(`\\b${phrase.replace(/[-\s]/g, '[-\\s]').replace('%', '%')}s?\\b`, 'i').test(text);

// The substitute group for an ingredient name, or null when there are none.
export function findSubstitutes(name) {
  const text = String(name ?? '').toLowerCase();
  if (!text.trim()) return null;
  for (const group of SUBSTITUTE_GROUPS) {
    if ((group.not ?? []).some((n) => wordIn(text, n))) continue;
    if (group.match.some((m) => wordIn(text, m))) {
      // Don't offer the ingredient as its own substitute ("almond flour" for "almond flour").
      const subs = group.subs.filter((s) => !wordIn(text, s.name.toLowerCase()));
      return subs.length ? { ...group, subs } : null;
    }
  }
  return null;
}

// ---- Amounts ----

const FRACTION_GLYPHS = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'], [1, '']];

// 1.75 → "1 ¾", 0.4375 → "½" (nearest kitchen fraction), 3 → "3".
export function kitchenNumber(value) {
  if (!(value > 0)) return '';
  let whole = Math.floor(value);
  const [frac, glyph] = FRACTION_GLYPHS.reduce((best, f) => (Math.abs(value - whole - f[0]) < Math.abs(value - whole - best[0]) ? f : best));
  if (frac === 1) whole += 1;
  if (!whole && !glyph) return '⅛';
  return [whole || '', glyph].filter(Boolean).join(' ');
}

const UNIT_WORDS = {
  cup: ['cup', 'cups'], tbsp: ['tablespoon', 'tablespoons'], tsp: ['teaspoon', 'teaspoons'], floz: ['fl oz', 'fl oz'],
  oz: ['ounce', 'ounces'], lb: ['pound', 'pounds'], g: ['g', 'g'], kg: ['kg', 'kg'], ml: ['ml', 'ml'], l: ['liter', 'liters'],
  pint: ['pint', 'pints'], quart: ['quart', 'quarts'], pinch: ['pinch', 'pinches'], dash: ['dash', 'dashes'],
  clove: ['clove', 'cloves'], can: ['can', 'cans'], slice: ['slice', 'slices'], piece: ['piece', 'pieces'],
  package: ['package', 'packages'], bunch: ['bunch', 'bunches'], head: ['head', 'heads'], sprig: ['sprig', 'sprigs'], stalk: ['stalk', 'stalks'],
};
const unitWord = (unit, quantity) => (UNIT_WORDS[unit] ? UNIT_WORDS[unit][quantity > 1 ? 1 : 0] : '');

// Amounts the way recipes write them: under ½ cup in tablespoons unless it's an even ¼ or ⅓ cup,
// and under a tablespoon in teaspoons ("⅜ cup" → "6 tablespoons").
function tidyAmount(quantity, unit) {
  const near = (a, b) => Math.abs(a - b) < 0.02;
  if (unit === 'cup' && quantity < 0.5 && !near(quantity, 0.25) && !near(quantity, 1 / 3)) {
    return tidyAmount(Math.round(quantity * 16 * 2) / 2, 'tbsp');
  }
  if (unit === 'tbsp' && quantity < 1) return { quantity: Math.round(quantity * 3 * 4) / 4, unit: 'tsp' };
  return { quantity, unit };
}

// The amount an ingredient uses: { quantity, unit }, read from its serving text × servings.
// parseLine is parseIngredientLine (passed in to keep this module free of the parser's imports).
export function ingredientAmount(ingredient, parseLine) {
  const parsed = ingredient.servingSize ? parseLine(ingredient.servingSize) : null;
  const servings = ingredient.servings ?? 1;
  if (parsed?.quantity != null) return { quantity: parsed.quantity * servings, unit: parsed.unit };
  return { quantity: servings, unit: null };
}

// The recipe line for a swap ("1 ¾ cups almond flour"), or just the name when the amount has to be
// entered by hand (e.g. zucchini noodles for pasta).
export function swapLine(ingredient, substitute, parseLine) {
  let { quantity, unit } = ingredientAmount(ingredient, parseLine);
  // A stick of butter is ½ cup, so volume ratios can apply to it.
  if (unit === 'stick') { quantity *= 0.5; unit = 'cup'; }
  const name = substitute.name.charAt(0).toLowerCase() + substitute.name.slice(1);
  const write = (q, u, what) => {
    const t = tidyAmount(q, u);
    return `${kitchenNumber(t.quantity)} ${unitWord(t.unit, t.quantity)} ${what}`.replace(/\s+/g, ' ').trim();
  };
  if (substitute.per && quantity) return write(quantity * substitute.per.quantity, substitute.per.unit, substitute.per.name);
  // A count with no unit ("2 tortillas") keeps counting.
  if (substitute.ratio != null && quantity) return write(quantity * substitute.ratio, unit, name);
  return name;
}

// Tags used by these substitutes, in display order (for filter chips).
export const tagsIn = (subs) => SWAP_TAGS.filter((t) => subs.some((s) => s.tags.includes(t.key)));

// The swap tag matching the diet a person follows (Settings → Your diet), if any.
export function tagForFollowedDiet(diet) {
  if (diet === 'vegan' || diet === 'rawVegan' || diet === 'fruitarian') return 'vegan';
  if (diet === 'vegetarian' || diet === 'lactoVegetarian' || diet === 'ovoVegetarian') return 'vegetarian';
  return null;
}
