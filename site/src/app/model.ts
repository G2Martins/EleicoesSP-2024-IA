// Inference identical to sklearn's multinomial LogisticRegression.predict_proba (softmax over X·coefᵀ + intercept).
// No imports on purpose: scripts/check.ts runs this file directly in Node (type stripping) against fixtures.json,
// which holds sklearn's own probabilities.

export interface VoteModel {
  features: string[];
  classes: string[];
  coef: number[][];
  intercept: number[];
}

export type Voter = Record<string, number>;

/** Logit of each class: intercept[k] + sum_j coef[k][j] * x[j]. */
export function logits(m: VoteModel, x: Voter): number[] {
  return m.coef.map((row, k) => row.reduce((z, c, j) => z + c * x[m.features[j]], m.intercept[k]));
}

/** Softmax with the max subtracted first, like scipy.special.softmax used by sklearn. */
export function predict(m: VoteModel, x: Voter): number[] {
  const z = logits(m, x);
  const top = Math.max(...z);
  const e = z.map((v) => Math.exp(v - top));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}
