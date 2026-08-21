/**
 * Resource-prediction tuning data.
 * Base per-person meal/water quantities and the extra allowances for
 * vulnerable groups. Consumed by services/resources/prediction.service.js.
 */

export const BASE_QTY = {
  breakfast: 0.5, // kg per person
  lunch: 0.6,
  dinner: 0.5,
  water: 15, // litres per person
};

export const VULNERABLE_EXTRA = {
  pregnant: { breakfast: 0.2, lunch: 0.2, dinner: 0.2, water: 2 },
  chronic_illness: { breakfast: 0.1, lunch: 0.1, dinner: 0.1, water: 1 },
};
