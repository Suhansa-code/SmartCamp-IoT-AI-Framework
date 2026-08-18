// Mock data for the alert dashboard (replace with real API).

export const MOCK_CAMPS = [
  { id: 'all',   name: 'All Camps',        code: 'ALL', count: 0 },
  { id: 'hmg',   name: 'Hambantota Main',  code: 'HMG', count: 3 },
  { id: 'gal',   name: 'Galle North',      code: 'GAL', count: 2 },
  { id: 'mat',   name: 'Matara East',      code: 'MAT', count: 1 },
  { id: 'kal',   name: 'Kalutara South',   code: 'KAL', count: 4 },
]

export function mockAlerts() {
  return [
    {
      id: 'a1', childId: 'HMG-012', campId: 'hmg', campName: 'Hambantota Main',
      alertType: 'Low inhibition score', severity: 'high',
      status: 'pending', triggeredAt: Date.now() - 86400000 * 2,
      scores: [
        { session: 1, score: 72 }, { session: 2, score: 65 },
        { session: 3, score: 58 }, { session: 4, score: 49 }, { session: 5, score: 44 },
      ],
    },
    {
      id: 'a2', childId: 'GAL-007', campId: 'gal', campName: 'Galle North',
      alertType: 'High false-tap rate', severity: 'medium',
      status: 'pending', triggeredAt: Date.now() - 86400000 * 1,
      scores: [
        { session: 1, score: 80 }, { session: 2, score: 74 },
        { session: 3, score: 68 }, { session: 4, score: 60 }, { session: 5, score: 53 },
      ],
    },
    {
      id: 'a3', childId: 'HMG-019', campId: 'hmg', campName: 'Hambantota Main',
      alertType: 'Repeated missed targets', severity: 'medium',
      status: 'escalated', triggeredAt: Date.now() - 86400000 * 4,
      scores: [
        { session: 1, score: 55 }, { session: 2, score: 50 },
        { session: 3, score: 45 }, { session: 4, score: 40 }, { session: 5, score: 38 },
      ],
    },
    {
      id: 'a4', childId: 'KAL-003', campId: 'kal', campName: 'Kalutara South',
      alertType: 'Slow reaction time trend', severity: 'low',
      status: 'resolved', triggeredAt: Date.now() - 86400000 * 6,
      scores: [
        { session: 1, score: 60 }, { session: 2, score: 65 },
        { session: 3, score: 70 }, { session: 4, score: 74 }, { session: 5, score: 78 },
      ],
    },
    {
      id: 'a5', childId: 'MAT-011', campId: 'mat', campName: 'Matara East',
      alertType: 'High RT variability', severity: 'low',
      status: 'pending', triggeredAt: Date.now() - 86400000 * 0.5,
      scores: [
        { session: 1, score: 76 }, { session: 2, score: 72 },
        { session: 3, score: 69 }, { session: 4, score: 64 }, { session: 5, score: 57 },
      ],
    },
    {
      id: 'a6', childId: 'KAL-021', campId: 'kal', campName: 'Kalutara South',
      alertType: 'Session abandoned mid-task', severity: 'high',
      status: 'escalated', triggeredAt: Date.now() - 86400000 * 3,
      scores: [
        { session: 1, score: 82 }, { session: 2, score: 75 },
        { session: 3, score: 62 }, { session: 4, score: 51 }, { session: 5, score: 41 },
      ],
    },
  ]
}