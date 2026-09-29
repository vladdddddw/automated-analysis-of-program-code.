import { SEVERITIES } from "../../api/seed.js";

// Кольорова позначка серйозності зауваження
export function SeverityBadge({ severity }) {
  return <span className={`badge sev-${severity}`}>{SEVERITIES[severity]?.label ?? severity}</span>;
}

export function StatusBadge({ status }) {
  return <span className={`badge ${status === "done" ? "st-done" : "st-failed"}`}>{status === "done" ? "Виконано" : "Помилка"}</span>;
}
