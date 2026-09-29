import { useId } from "react";

// Поле форми: підпис, елемент введення та повідомлення про помилку валідації.
export default function FormField({ label, error, hint, children }) {
  const id = useId();
  return (
    <div className={`field ${error ? "field-invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children(id, error ? `${id}-err` : undefined)}
      {error ? (
        <span className="field-error" id={`${id}-err`} role="alert">{error}</span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}
