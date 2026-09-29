import { SEVERITIES } from "../../api/seed.js";

// Розподіл зауважень за серйозністю (горизонтальні смуги на CSS, без сторонніх бібліотек)
export function SeverityChart({ issues }) {
  const counts = Object.keys(SEVERITIES).map((key) => ({ key, count: issues.filter((i) => i.severity === key).length }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <div className="chart" aria-label="Розподіл зауважень за серйозністю">
      {counts.reverse().map(({ key, count }) => (
        <div className="bar-row" key={key}>
          <span className="bar-label">{SEVERITIES[key].label}</span>
          <div className="bar-track">
            <div className={`bar-fill sev-bg-${key}`} style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="bar-value">{count}</span>
        </div>
      ))}
    </div>
  );
}

// Цикломатична складність функцій; функції вище порога підсвічуються
export function ComplexityChart({ functions, threshold = 10 }) {
  const items = [...functions].sort((a, b) => b.complexity - a.complexity).slice(0, 8);
  if (items.length === 0) return <p className="muted">Функцій не знайдено</p>;
  const max = Math.max(threshold, ...items.map((f) => f.complexity));
  return (
    <div className="chart" aria-label="Цикломатична складність функцій">
      {items.map((f, idx) => (
        <div className="bar-row" key={`${f.name}-${f.startLine}-${idx}`}>
          <span className="bar-label mono" title={f.name}>{f.name}</span>
          <div className="bar-track">
            <div className={`bar-fill ${f.complexity > threshold ? "sev-bg-high" : "sev-bg-low"}`}
              style={{ width: `${(f.complexity / max) * 100}%` }} />
            <div className="bar-threshold" style={{ left: `${(threshold / max) * 100}%` }} title={`Поріг ${threshold}`} />
          </div>
          <span className="bar-value">{f.complexity}</span>
        </div>
      ))}
    </div>
  );
}
