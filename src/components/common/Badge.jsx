import { CheckCircle2, XCircle } from "lucide-react";
import { SEVERITIES } from "../../api/seed.js";

// Кольорова позначка серйозності зауваження
export function SeverityBadge({ severity }) {
  return <span className={`badge sev-${severity}`}><i className="dot" />{SEVERITIES[severity]?.label ?? severity}</span>;
}

export function StatusBadge({ status }) {
  const ok = status === "done";
  return (
    <span className={`badge ${ok ? "st-done" : "st-failed"}`}>
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {ok ? "Виконано" : "Помилка"}
    </span>
  );
}
