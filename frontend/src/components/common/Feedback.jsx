import { AlertCircle, Inbox } from "lucide-react";
import Button from "./Button.jsx";

export function Spinner({ label = "Завантаження…" }) {
  return (
    <div className="center-box" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="muted">{label}</span>
    </div>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="center-box empty">
      <span className="empty-icon" aria-hidden="true"><Inbox size={28} /></span>
      <strong>{title}</strong>
      {text && <span className="muted">{text}</span>}
      {action}
    </div>
  );
}

// Повідомлення про помилку запиту з можливістю повторити дію
export function ErrorState({ error, onRetry }) {
  return (
    <div className="alert alert-error" role="alert">
      <AlertCircle size={20} />
      <span className="grow">{error?.message || "Сталася помилка"}</span>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Повторити</Button>}
    </div>
  );
}
