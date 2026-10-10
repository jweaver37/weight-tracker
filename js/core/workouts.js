// Workout calorie estimates from MET values (Compendium of Physical Activities).
// Net calories: (MET − 1) × body weight (kg) × hours. The 1 MET your body burns at rest
// is already in the daily calorie target, so counting it here would count it twice.

// Starter list. Values are rounded from the Compendium; users can add their own activities.
export const STARTER_ACTIVITIES = [
  { key: 'walk-slow', category: 'Walking & hiking', name: 'Walking, slow (2 mph)', met: 2.8 },
  { key: 'walk-moderate', category: 'Walking & hiking', name: 'Walking, moderate (3 mph)', met: 3.5 },
  { key: 'walk-brisk', category: 'Walking & hiking', name: 'Walking, brisk (3.5 mph)', met: 4.3 },
  { key: 'walk-fast', category: 'Walking & hiking', name: 'Walking, very brisk (4 mph)', met: 5.0 },
  { key: 'hike', category: 'Walking & hiking', name: 'Hiking', met: 6.0 },
  { key: 'run-12', category: 'Running', name: 'Running, 12 min/mile (5 mph)', met: 8.3 },
  { key: 'run-10', category: 'Running', name: 'Running, 10 min/mile (6 mph)', met: 9.8 },
  { key: 'run-8.5', category: 'Running', name: 'Running, 8.5 min/mile (7 mph)', met: 11.0 },
  { key: 'bike-leisure', category: 'Cycling', name: 'Cycling, leisurely (under 10 mph)', met: 4.0 },
  { key: 'bike-moderate', category: 'Cycling', name: 'Cycling, moderate (12–14 mph)', met: 8.0 },
  { key: 'bike-stationary', category: 'Cycling', name: 'Stationary bike, moderate', met: 6.8 },
  { key: 'elliptical', category: 'Gym cardio', name: 'Elliptical, moderate', met: 5.0 },
  { key: 'rower', category: 'Gym cardio', name: 'Rowing machine, moderate', met: 7.0 },
  { key: 'stair-machine', category: 'Gym cardio', name: 'Stair climber', met: 9.0 },
  { key: 'jump-rope', category: 'Gym cardio', name: 'Jumping rope', met: 11.8 },
  { key: 'weights-moderate', category: 'Strength & classes', name: 'Weight lifting, moderate', met: 3.5 },
  { key: 'weights-vigorous', category: 'Strength & classes', name: 'Weight lifting, vigorous', met: 6.0 },
  { key: 'circuit', category: 'Strength & classes', name: 'Circuit training', met: 8.0 },
  { key: 'aerobics-low', category: 'Strength & classes', name: 'Aerobics, low impact', met: 5.0 },
  { key: 'yoga', category: 'Strength & classes', name: 'Yoga', met: 2.5 },
  { key: 'pilates', category: 'Strength & classes', name: 'Pilates', met: 3.0 },
  { key: 'swim-moderate', category: 'Sports & water', name: 'Swimming laps, moderate', met: 5.8 },
  { key: 'swim-vigorous', category: 'Sports & water', name: 'Swimming laps, vigorous', met: 9.8 },
  { key: 'basketball', category: 'Sports & water', name: 'Basketball, game', met: 6.5 },
  { key: 'tennis', category: 'Sports & water', name: 'Tennis, singles', met: 8.0 },
  { key: 'golf-walk', category: 'Sports & water', name: 'Golf, walking with clubs', met: 4.3 },
  { key: 'yard-work', category: 'Around the house', name: 'Yard work, general', met: 4.0 },
  { key: 'mowing', category: 'Around the house', name: 'Mowing, push mower', met: 5.0 },
  { key: 'cleaning', category: 'Around the house', name: 'House cleaning, general', met: 3.5 },
];

export const RESTING_MET = 1;

export const caloriesBurned = (met, weightKg, minutes) => Math.max(0, met - RESTING_MET) * weightKg * (minutes / 60);

export const totalBurned = (workouts) => workouts.reduce((sum, w) => sum + (w.calories ?? 0), 0);

// Activity references are 'starter:<key>' or 'custom:<id>' so both kinds share one picker.
export const starterRef = (key) => `starter:${key}`;
export const customRef = (id) => `custom:${id}`;

export function findActivity(ref, customActivities) {
  const [kind, id] = ref.split(/:(.*)/s);
  if (kind === 'starter') {
    const a = STARTER_ACTIVITIES.find((s) => s.key === id);
    return a && { ref, name: a.name, met: a.met };
  }
  const a = customActivities.find((c) => c.id === id);
  return a && { ref, name: a.name, met: a.met };
}
