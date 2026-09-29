import { useId } from "react";
import { SEVERITIES } from "../../api/seed.js";

const ORDER = ["critical", "high", "medium", "low", "info"];

// Кільцева діаграма розподілу зауважень за серйозністю (counts = { critical: n, ... })
export function SeverityDonut({ counts, size = 170 }) {
  const total = ORDER.reduce((s, k) => s + (counts[k] || 0), 0);
  const r = 62;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ width: size, height: size }}>
        <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label="Розподіл зауважень за серйозністю">
          <circle cx="80" cy="80" r={r} fill="none" stroke="var(--ring-track)" strokeWidth="18" />
          {total > 0 &&
            ORDER.map((k) => {
              const len = ((counts[k] || 0) / total) * c;
              const el = len > 0 && (
                <circle key={k} cx="80" cy="80" r={r} fill="none" stroke={`var(--sev-${k})`} strokeWidth="18"
                  strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)" />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="donut-center">
          <strong>{total}</strong>
          <span>зауважень</span>
        </div>
      </div>
      <ul className="legend">
        {ORDER.map((k) => (
          <li key={k}>
            <i className="legend-dot" style={{ background: `var(--sev-${k})` }} />
            <span>{SEVERITIES[k].label}</span>
            <b>{counts[k] || 0}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Горизонтальні смуги (використовується у звіті для розподілу за серйозністю)
export function SeverityChart({ issues }) {
  const counts = ORDER.map((key) => ({ key, count: issues.filter((i) => i.severity === key).length }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <div className="chart" aria-label="Розподіл зауважень за серйозністю">
      {counts.map(({ key, count }) => (
        <div className="bar-row" key={key}>
          <span className="bar-label">{SEVERITIES[key].label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / max) * 100}%`, background: `var(--sev-${key})` }} /></div>
          <span className="bar-value">{count}</span>
        </div>
      ))}
    </div>
  );
}

// Найчастіші правила: [{ id, name, count }]
export function TopRules({ items }) {
  if (!items.length) return <p className="muted">Зауважень поки немає</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <div className="chart">
      {items.map((i) => (
        <div className="bar-row bar-row-wide" key={i.id} title={i.name}>
          <span className="bar-label"><b className="mono">{i.id}</b> {i.name}</span>
          <div className="bar-track"><div className="bar-fill grad" style={{ width: `${(i.count / max) * 100}%` }} /></div>
          <span className="bar-value">{i.count}</span>
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
            <div className="bar-fill" style={{ width: `${(f.complexity / max) * 100}%`, background: f.complexity > threshold ? "var(--sev-high)" : "var(--sev-low)" }} />
            <div className="bar-threshold" style={{ left: `${(threshold / max) * 100}%` }} title={`Поріг ${threshold}`} />
          </div>
          <span className="bar-value">{f.complexity}</span>
        </div>
      ))}
    </div>
  );
}

// Динаміка кількості зауважень по аналізах: points = [{ id, title, issues }]
export function TimelineChart({ points }) {
  const id = useId();
  if (points.length === 0) return <p className="muted">Даних поки немає</p>;
  const W = 460, H = 190, pl = 34, pr = 14, pt = 16, pb = 30;
  const max = Math.max(4, ...points.map((p) => p.issues));
  const x = (i) => (points.length === 1 ? (pl + W - pr) / 2 : pl + (i * (W - pl - pr)) / (points.length - 1));
  const y = (v) => pt + (1 - v / max) * (H - pt - pb);
  const line = points.map((p, i) => `${x(i)},${y(p.issues)}`).join(" ");
  const area = `${x(0)},${H - pb} ${line} ${x(points.length - 1)},${H - pb}`;
  const ticks = [0, Math.round(max / 2), max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="timeline" role="img" aria-label="Динаміка зауважень">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity=".35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="4 4" />
          <text x={pl - 8} y={y(t) + 4} textAnchor="end" className="tl-text">{t}</text>
        </g>
      ))}
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke="var(--primary)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.id}>
          <circle cx={x(i)} cy={y(p.issues)} r="5" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.6">
            <title>{`${p.title}: ${p.issues}`}</title>
          </circle>
          <text x={x(i)} y={H - 8} textAnchor="middle" className="tl-text">№{p.id}</text>
        </g>
      ))}
    </svg>
  );
}
