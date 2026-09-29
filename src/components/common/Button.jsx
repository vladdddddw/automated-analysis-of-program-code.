// Універсальна кнопка: варіанти primary / secondary / danger / ghost, стан завантаження.
export default function Button({ variant = "primary", loading = false, disabled, children, className = "", ...rest }) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="spinner spinner-sm" aria-hidden="true" />}
      {children}
    </button>
  );
}
