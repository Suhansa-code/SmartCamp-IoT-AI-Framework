import C from '../../config/constants.js';

export function applyFirstGate(compositeScore) {
  return compositeScore >= C.GATE_THRESHOLD ? C.GATE.PASS : C.GATE.FAIL_FIRST;
}

export function applySecondGate(compositeScore) {
  return compositeScore >= C.GATE_THRESHOLD ? C.GATE.PASS_RECOVERED : C.GATE.FAIL_CONFIRMED;
}

export function updateBaseline(oldBaseline, compositeScore) {
  const newBaseline = oldBaseline * (1 - C.BASELINE_ALPHA) + compositeScore * C.BASELINE_ALPHA;
  return Math.round(newBaseline * 100) / 100;
}
