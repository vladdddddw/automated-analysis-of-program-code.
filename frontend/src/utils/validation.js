const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Валідація форм входу та реєстрації. Повертає об’єкт помилок (порожній, якщо все коректно).
export function validateCredentials({ email, password, confirm }, { register = false } = {}) {
  const errors = {};
  if (!email.trim()) errors.email = "Введіть email";
  else if (!EMAIL_RE.test(email.trim())) errors.email = "Некоректний формат email, наприклад name@example.com";
  if (!password) errors.password = "Введіть пароль";
  else if (register && password.length < 6) errors.password = "Пароль має містити щонайменше 6 символів";
  if (register && confirm !== password) errors.confirm = "Паролі не збігаються";
  return errors;
}

export const MAX_FILE_BYTES = 1_000_000;

export function validateThreshold(value) {
  if (value === "" || value === null) return "Введіть поріг";
  const n = Number(value);
  if (!Number.isInteger(n)) return "Поріг має бути цілим числом";
  if (n < 1 || n > 500) return "Поріг має бути від 1 до 500";
  return null;
}
