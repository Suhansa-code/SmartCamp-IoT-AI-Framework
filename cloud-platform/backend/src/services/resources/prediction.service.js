/**
 * Resource prediction for tomorrow based on rolling daily snapshots.
 * Uses weighted linear regression — no external ML library required.
 * More recent days carry exponentially higher weight in all averages.
 */
import { BASE_QTY, VULNERABLE_EXTRA } from '../../data/resources/prediction.data.js';

function r1(v) {
  return Math.round(v * 10) / 10;
}
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Linearly weighted average: index 0 = weight 1, index n-1 = weight n
export function linearWeightedAvg(values) {
  if (!values.length) return 0;
  const n = values.length;
  const totalW = (n * (n + 1)) / 2;
  return values.reduce((s, v, i) => s + v * (i + 1), 0) / totalW;
}

export function computePrediction({ snapshots = [], totalPersons = 0, pregnant = 0, chronic = 0 }) {
  const n = snapshots.length;

  const confidence = n >= 7 ? 'HIGH' : n >= 3 ? 'MEDIUM' : 'LOW';

  let expectedNew;
  if (n === 0) {
    expectedNew = Math.ceil(totalPersons * 0.1);
  } else {
    const newArrivalSeries = snapshots.map((s) => s.new_registrations);
    const rawAvg = linearWeightedAvg(newArrivalSeries);

    if (n >= 3) {
      const lastThird = snapshots.slice(-3).map((s) => s.new_registrations);
      const trend = lastThird[lastThird.length - 1] - lastThird[0];
      expectedNew = Math.max(0, Math.round(rawAvg + trend * 0.3));
    } else {
      expectedNew = Math.max(0, Math.round(rawAvg));
    }
  }

  let attendanceRate = 0.85;
  const usable = snapshots.filter((s) => s.total_persons > 0 && s.checkins > 0);
  if (usable.length > 0) {
    const rates = usable.map((s) => Math.min(1, s.checkins / s.total_persons));
    attendanceRate = clamp(linearWeightedAvg(rates), 0.5, 0.99);
  }

  const expectedTotal = totalPersons + expectedNew;
  const expectedAttending = Math.ceil(expectedTotal * attendanceRate);

  const meals = ['breakfast', 'lunch', 'dinner'];
  const quantities = {};
  for (const meal of meals) {
    quantities[`${meal}_kg`] = r1(
      expectedAttending * BASE_QTY[meal] +
        pregnant * VULNERABLE_EXTRA.pregnant[meal] +
        chronic * VULNERABLE_EXTRA.chronic_illness[meal],
    );
  }
  quantities.water_litres = r1(
    expectedAttending * BASE_QTY.water +
      pregnant * VULNERABLE_EXTRA.pregnant.water +
      chronic * VULNERABLE_EXTRA.chronic_illness.water,
  );

  const noteParts = [];
  if (pregnant > 0) noteParts.push(`${pregnant} pregnant (+0.2 kg/meal, +2 L water each)`);
  if (chronic > 0) noteParts.push(`${chronic} chronic illness (+0.1 kg/meal, +1 L water each)`);
  if (confidence === 'LOW') noteParts.push('Low confidence — less than 3 days of data');
  const note = noteParts.join(' · ') || 'Standard rations';

  return {
    expected_persons: expectedAttending,
    expected_new_arrivals: expectedNew,
    attendance_rate_pct: Math.round(attendanceRate * 100),
    ...quantities,
    confidence,
    days_of_data: n,
    note,
  };
}