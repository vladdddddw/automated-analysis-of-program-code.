// Оцінка якості коду (0–100): від 100 віднімаються штрафи за зауваження залежно від серйозності.
const PENALTY = { critical: 18, high: 10, medium: 5, low: 2, info: 0.5 };

export function qualityScore(issues) {
  const penalty = issues.reduce((s, i) => s + (PENALTY[i.severity] ?? 0), 0);
  return Math.max(0, Math.round(100 - penalty));
}

export function scoreMeta(score) {
  if (score === null || score === undefined) return { label: "Немає оцінки", tone: "muted" };
  if (score >= 85) return { label: "Відмінно", tone: "great" };
  if (score >= 65) return { label: "Добре", tone: "good" };
  if (score >= 40) return { label: "Задовільно", tone: "warn" };
  return { label: "Потребує уваги", tone: "bad" };
}
