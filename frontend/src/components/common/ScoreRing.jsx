import { useId } from "react";
import { scoreMeta } from "../../utils/score.js";

// Кільцевий індикатор оцінки якості (0–100)
export default function ScoreRing({ score, size = 120, stroke = 10, showLabel = true }) {
  const id = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const meta = scoreMeta(score);
  const value = score ?? 0;
  return (
    <div className={`ring ring-${meta.tone}`} style={{ width: size, height: size }} role="img" aria-label={`Оцінка якості ${score ?? "немає"}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--ring-a)" />
            <stop offset="100%" stopColor="var(--ring-b)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="ring-arc" />
      </svg>
      <div className="ring-center">
        <strong style={{ fontSize: size * 0.3 }}>{score ?? "—"}</strong>
        {showLabel && size >= 100 && <span>{meta.label}</span>}
      </div>
    </div>
  );
}
