import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { validateCredentials } from "../utils/validation.js";
import FormField from "../components/common/FormField.jsx";
import Button from "../components/common/Button.jsx";
import { DEMO_USERS, ROLE_LABELS } from "../api/seed.js";

function AuthShell({ title, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo logo-large">
          <span className="logo-mark">{"</>"}</span>
          <span className="logo-text">CodeInspector</span>
        </div>
        <h1>{title}</h1>
        {children}
        <p className="auth-footer">{footer}</p>
      </div>
    </div>
  );
}

// Сторінка входу: контрольована форма, валідація на клієнті, помилки сервера в сповіщеннях.
export function LoginPage() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  if (user) return <Navigate to="/analyze" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const v = validateCredentials(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setLoading(true);
    setServerError("");
    try {
      await login(form); // POST /api/auth/login
      toast.success("Ви успішно увійшли в систему");
      navigate(location.state?.from || "/analyze", { replace: true });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Вхід у систему" footer={<>Немає облікового запису? <Link to="/register">Зареєструватися</Link></>}>
      <form onSubmit={submit} noValidate>
        <FormField label="Email" error={errors.email}>
          {(id, err) => <input id={id} type="email" autoComplete="username" value={form.email} onChange={set("email")}
            aria-describedby={err} placeholder="name@example.com" />}
        </FormField>
        <FormField label="Пароль" error={errors.password}>
          {(id, err) => <input id={id} type="password" autoComplete="current-password" value={form.password}
            onChange={set("password")} aria-describedby={err} />}
        </FormField>
        {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
        <Button type="submit" loading={loading} className="btn-block">Увійти</Button>
      </form>
      <div className="demo-box">
        <strong>Демо-акаунти</strong>
        <span className="muted small">Бекенд не підключено – натисніть, щоб заповнити форму:</span>
        <div className="demo-list">
          {DEMO_USERS.map((u) => (
            <button key={u.id} type="button" className="chip" onClick={() => { setForm({ email: u.email, password: u.password }); setErrors({}); setServerError(""); }}>
              {ROLE_LABELS[u.role]}
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  if (user) return <Navigate to="/analyze" replace />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const v = validateCredentials(form, { register: true });
    setErrors(v);
    if (Object.keys(v).length) return;
    setLoading(true);
    setServerError("");
    try {
      await register({ email: form.email, password: form.password }); // POST /api/auth/register
      toast.success("Обліковий запис створено");
      navigate("/analyze", { replace: true });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Реєстрація" footer={<>Уже є обліковий запис? <Link to="/login">Увійти</Link></>}>
      <form onSubmit={submit} noValidate>
        <FormField label="Email" error={errors.email}>
          {(id, err) => <input id={id} type="email" autoComplete="username" value={form.email} onChange={set("email")} aria-describedby={err} />}
        </FormField>
        <FormField label="Пароль" error={errors.password} hint="Щонайменше 6 символів">
          {(id, err) => <input id={id} type="password" autoComplete="new-password" value={form.password} onChange={set("password")} aria-describedby={err} />}
        </FormField>
        <FormField label="Підтвердження пароля" error={errors.confirm}>
          {(id, err) => <input id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} aria-describedby={err} />}
        </FormField>
        {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
        <Button type="submit" loading={loading} className="btn-block">Створити обліковий запис</Button>
      </form>
    </AuthShell>
  );
}
