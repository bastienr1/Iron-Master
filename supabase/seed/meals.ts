/**
 * Meal library seed, transcribed from Health/Meals Nutritional Facts Sheet.md
 * (updated 2026-11-12). Typed data, inserted by the import script.
 */
export type Accuracy = 'label' | 'weighed' | 'estimated'
export type Category = 'breakfast' | 'shake' | 'lunch' | 'dinner' | 'snack' | 'supplement' | 'drink' | 'fiber'

export interface MealSeed {
  name: string
  category: Category
  portion: string
  kcal: number
  protein_g: number
  fiber_g: number | null
  accuracy: Accuracy
  items: { name: string; grams: number | null; kcal: number; protein_g: number; fiber_g: number | null; accuracy: Accuracy }[]
  notes: string | null
}

const it = (name: string, grams: number | null, kcal: number, protein_g: number, fiber_g: number | null, accuracy: Accuracy) => ({ name, grams, kcal, protein_g, fiber_g, accuracy })

export const MEAL_LIBRARY: readonly MealSeed[] = [
  {
    name: 'Usual breakfast',
    category: 'breakfast',
    portion: '2 grilled white bread, 4 ham slices (80 g), 2 eggs, 250 g Greek yogurt, 30 g granola, 1 row Lindt 99%',
    kcal: 766, protein_g: 57, fiber_g: 5, accuracy: 'estimated',
    items: [
      it('Ham, 4 slices', 80, 90, 14.5, 0, 'estimated'),
      it('White bread, grilled, 2 slices', 60, 160, 5, 1.5, 'estimated'),
      it('Eggs, sunny-side, 2', null, 180, 12.5, 0, 'estimated'),
      it('Greek yogurt', 250, 138, 21, 0, 'label'),
      it('Granola', 30, 141, 3, 2, 'label'),
      it('Lindt 99% cacao, 1 row', 10, 57, 1.4, 1.7, 'label'),
    ],
    notes: 'labels + estimates · bread, ham, 2 eggs, yogurt, granola',
  },
  {
    name: 'Supplements',
    category: 'supplement',
    portion: 'Omega-3, 1 multivitamin, 4 scoops Cell-Tech creatine',
    kcal: 10, protein_g: 0, fiber_g: 0, accuracy: 'label',
    items: [it('Omega-3 softgel', null, 10, 0, 0, 'label'), it('Multivitamin', null, 0, 0, 0, 'label'), it('Cell-Tech creatine, 4 scoops', 7, 0, 0, 0, 'label')],
    notes: '~5 g creatine a day',
  },
  {
    name: 'Post-workout shake',
    category: 'shake',
    portion: '1 scoop ON whey + 250 ml Pauls full cream milk',
    kcal: 295, protein_g: 33, fiber_g: 0, accuracy: 'label',
    items: [it('ON Gold Standard whey, 1 scoop', 30, 120, 24, 0, 'label'), it('Pauls full cream milk', 250, 173, 8.5, 0, 'label')],
    notes: 'label · 1 scoop whey + 250 ml Pauls milk',
  },
  {
    name: 'Double shake',
    category: 'shake',
    portion: '2 scoops ON whey + 250 ml Pauls full cream milk',
    kcal: 415, protein_g: 57, fiber_g: 0, accuracy: 'label',
    items: [it('ON Gold Standard whey, 2 scoops', 60, 240, 48, 0, 'label'), it('Pauls full cream milk', 250, 173, 8.5, 0, 'label')],
    notes: null,
  },
  {
    name: 'Shake lunch',
    category: 'shake',
    portion: '2 scoops ON whey + 400 ml Pauls full cream milk + 1 banana',
    kcal: 621, protein_g: 63, fiber_g: 3, accuracy: 'label',
    items: [it('ON Gold Standard whey, 2 scoops', 60, 240, 48, 0, 'label'), it('Pauls full cream milk', 400, 276, 13.6, 0, 'label'), it('Banana, 1 medium', 120, 105, 1, 3, 'weighed')],
    notes: null,
  },
  {
    name: 'Shake with Meiji milk',
    category: 'shake',
    portion: '2 scoops ON whey + Meiji strawberry milk 200 ml',
    kcal: 360, protein_g: 54, fiber_g: 0, accuracy: 'label',
    items: [it('ON Gold Standard whey, 2 scoops', 60, 240, 48, 0, 'label'), it('Meiji strawberry milk', 200, 122, 5.8, 0, 'label')],
    notes: null,
  },
  {
    name: 'Hao Liao bowl',
    category: 'lunch',
    portion: 'chicken 210 g, BBQ tofu 46 g, edamame 55 g, broccoli 42 g, steamed potato 51 g, brown rice 175 g, 1 fried egg, no sauce',
    kcal: 799, protein_g: 88, fiber_g: 8.6, accuracy: 'weighed',
    items: [
      it('Chicken breast', 210, 347, 65, 0, 'weighed'),
      it('BBQ tofu', 46, 40, 4, 0.4, 'weighed'),
      it('Edamame', 55, 67, 6.5, 2.8, 'weighed'),
      it('Broccoli', 42, 15, 1, 1.4, 'weighed'),
      it('Steamed potato', 51, 44, 1, 1, 'weighed'),
      it('Three-colour brown rice', 175, 196, 4.6, 3, 'weighed'),
      it('Fried egg', null, 90, 6, 0, 'estimated'),
    ],
    notes: 'weighed · best protein per calorie you log. Chia sesame sauce adds 100–200 kcal.',
  },
  {
    name: "JT's pecho set + kangkong",
    category: 'lunch',
    portion: 'Pecho chicken 206 g with oily sauce, plain rice 153 g, adobong kangkong 152 g',
    kcal: 800, protein_g: 64, fiber_g: 4, accuracy: 'weighed',
    items: [
      it('Chicken inasal, breast + wing, skin on', 206, 390, 56, 0, 'weighed'),
      it('Oily sauce, ~1 tbsp', 15, 80, 0, 0, 'estimated'),
      it('Plain rice', 153, 200, 4, 0.6, 'weighed'),
      it('Adobong kangkong', 152, 130, 4, 3.5, 'weighed'),
    ],
    notes: 'weighed · sauce amount guessed',
  },
  {
    name: 'Time For Thai, shared',
    category: 'dinner',
    portion: 'garlic chicken 250 g, stir-fry mixed vegetables 280 g, 2 spring rolls, white rice 200 g',
    kcal: 1190, protein_g: 53, fiber_g: 10, accuracy: 'estimated',
    items: [
      it('M8 Garlic chicken', 250, 500, 38, 0, 'estimated'),
      it('V6 Stir-fry mixed vegetables', 280, 250, 7, 8, 'estimated'),
      it('A7 Spring rolls, 2', 70, 180, 3, 1.5, 'estimated'),
      it('White rice, cooked', 200, 260, 5, 0.8, 'weighed'),
    ],
    notes: 'box weights estimated · weigh once',
  },
  {
    name: 'Din Tai Fung dinner',
    category: 'dinner',
    portion: 'xiao long bao 130 g, pork chop 150 g, egg fried rice 268 g, spinach with beancurd 261 g',
    kcal: 1400, protein_g: 73, fiber_g: 6, accuracy: 'weighed',
    items: [
      it('Xiao long bao', 130, 272, 12.5, 0.5, 'weighed'),
      it('Fried pork chop', 150, 410, 35, 0, 'weighed'),
      it('Egg fried rice', 268, 482, 14.5, 1.5, 'weighed'),
      it('Stir-fried spinach with beancurd', 261, 235, 11.5, 4, 'weighed'),
    ],
    notes: 'weighed · no published nutrition data, midpoints of estimates',
  },
  {
    name: 'Sweet and sour fish dinner',
    category: 'dinner',
    portion: 'fish 150 g, brown rice 150 g, green beans 130 g',
    kcal: 520, protein_g: 23, fiber_g: 6, accuracy: 'weighed',
    items: [it('Sweet and sour fish, battered', 150, 280, 16, 0, 'weighed'), it('Brown rice, cooked', 150, 168, 4, 2.6, 'weighed'), it('Green beans', 130, 72, 2.5, 3.5, 'weighed')],
    notes: null,
  },
  {
    name: 'Homemade spring rolls, 7',
    category: 'dinner',
    portion: '7 fried pork & beef spring rolls, 319 g',
    kcal: 800, protein_g: 32, fiber_g: 5, accuracy: 'weighed',
    items: [it('Fried pork + beef spring rolls', 319, 800, 32, 5, 'weighed')],
    notes: 'weighed · oil uptake estimated. ~250 kcal per 100 g',
  },
  {
    name: 'Barebells bar',
    category: 'snack',
    portion: '55 g',
    kcal: 190, protein_g: 20, fiber_g: 3.5, accuracy: 'label',
    items: [it('Barebells protein bar', 55, 190, 20, 3.5, 'label')],
    notes: null,
  },
  {
    name: 'Banana',
    category: 'snack',
    portion: '1 medium',
    kcal: 105, protein_g: 1, fiber_g: 3, accuracy: 'weighed',
    items: [it('Banana, 1 medium', 120, 105, 1, 3, 'weighed')],
    notes: null,
  },
  {
    name: 'Workout drinks',
    category: 'drink',
    portion: '1 × 100PLUS Original + 1 × 100PLUS Zero',
    kcal: 64, protein_g: 0, fiber_g: 0, accuracy: 'label',
    items: [it('100PLUS Original', 325, 64, 0, 0, 'label'), it('100PLUS Zero', 325, 0, 0, 0, 'label')],
    notes: '650 ml · the two cans of the last five sessions',
  },
  {
    name: 'Chicken leg',
    category: 'snack',
    portion: '1 whole leg, with skin',
    kcal: 300, protein_g: 30, fiber_g: 0, accuracy: 'estimated',
    items: [it('Chicken leg with skin', null, 300, 30, 0, 'estimated')],
    notes: null,
  },
  {
    name: 'Psyllium 10 g',
    category: 'fiber',
    portion: '10 g in water',
    kcal: 20, protein_g: 0, fiber_g: 8, accuracy: 'label',
    items: [it('Psyllium husk', 10, 20, 0, 8, 'label')],
    notes: 'fiber fixer · drink a full glass of water with it',
  },
  {
    name: '1 apple',
    category: 'fiber',
    portion: '1 medium, ~180 g',
    kcal: 95, protein_g: 0.5, fiber_g: 4.5, accuracy: 'estimated',
    items: [it('Apple', 180, 95, 0.5, 4.5, 'estimated')],
    notes: 'fiber fixer',
  },
  {
    name: '3 mandarins',
    category: 'fiber',
    portion: '3 mandarins',
    kcal: 135, protein_g: 2, fiber_g: 5, accuracy: 'estimated',
    items: [it('Mandarins, 3', 240, 135, 2, 5, 'estimated')],
    notes: 'fiber fixer',
  },
  {
    name: 'Greek yogurt 150 g',
    category: 'snack',
    portion: '150 g',
    kcal: 83, protein_g: 12.5, fiber_g: 0, accuracy: 'label',
    items: [it('Greek yogurt', 150, 83, 12.5, 0, 'label')],
    notes: null,
  },
  // Regulars added 2026-11-12 from the sheet's Regulars table.
  {
    name: 'Chihuahua wrap',
    category: 'lunch',
    portion: 'SaladStop! Chihuahua wrap: the bowl in a tortilla',
    kcal: 1092, protein_g: 63, fiber_g: 18, accuracy: 'estimated',
    items: [it('SaladStop! Chihuahua wrap', null, 1092, 63, 18, 'estimated')],
    notes: 'kcal from SaladStop! · protein and fiber estimated',
  },
  {
    name: 'Chihuahua bowl',
    category: 'dinner',
    portion: 'SaladStop! Chihuahua bowl: chicken, quinoa, spinach, cheddar, avocado, black beans, corn',
    kcal: 820, protein_g: 56, fiber_g: 15.4, accuracy: 'label',
    items: [it('SaladStop! Chihuahua bowl', null, 820, 56, 15.4, 'label')],
    notes: 'SaladStop! nutrition panel',
  },
  {
    name: 'Muscle Beach bowl',
    category: 'dinner',
    portion: 'Heybo Muscle Beach: quinoa, chicken breast, broccoli, avocado, carrot salad, seeds',
    kcal: 814, protein_g: 50, fiber_g: 15.2, accuracy: 'label',
    items: [it('Heybo Muscle Beach bowl', null, 814, 50, 15.2, 'label')],
    notes: 'Heybo nutrition panel',
  },
  {
    name: 'Greek yogurt 250 g',
    category: 'snack',
    portion: '250 g',
    kcal: 138, protein_g: 21, fiber_g: 0, accuracy: 'label',
    items: [it('Greek yogurt', 250, 138, 21, 0, 'label')],
    notes: null,
  },
  {
    name: 'Yogurt bowl',
    category: 'snack',
    portion: '250 g Greek yogurt, 30 g granola, 1 banana, 1 apple',
    kcal: 479, protein_g: 25.5, fiber_g: 9, accuracy: 'estimated',
    items: [it('Greek yogurt', 250, 138, 21, 0, 'label'), it('Granola', 30, 141, 3, 2, 'label'), it('Banana, 1 medium', 120, 105, 1, 3, 'estimated'), it('Apple', 180, 95, 0.5, 4, 'estimated')],
    notes: null,
  },
]
