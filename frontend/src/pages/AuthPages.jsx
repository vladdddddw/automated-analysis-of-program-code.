import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Gauge, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { validateCredentials } from "../utils/validation.js";
import FormField from "../components/common/FormField.jsx";
import Button from "../components/common/Button.jsx";
import Logo from "../components/common/Logo.jsx";
import { DEMO_USERS, ROLE_LABELS } from "../api/seed.js";
import { USE_BACKEND } from "../api/index.js";

// Двоколонкова сторінка автентифікації: ліворуч презентація продукту, праворуч форма.
function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <section className="auth-hero">
        <Logo light />
        <div className="hero-body">
          <span className="hero-pill"><Sparkles size={14} /> Автоматизований аналіз коду</span>
          <h1>Пишіть чистіший код без ручного рев’ю</h1>
          <p>Завантажте Python-код і за секунди отримайте зауваження, метрики складності та поради щодо виправлення.</p>
          <ul className="hero-list">
            <li><ShieldCheck size={18} /> Пошук небезпечних конструкцій і секретів</li>
            <li><Gauge size={18} /> Цикломатична складність, вкладеність, розмір функцій</li>
            <li><BarChart3 size={18} /> Графіки, історія та порівняння аналізів</li>
          </ul>
        </div>
        <div className="hero-code" aria-hidden="true">
          <div><span className="tk-kw">def</span> <span className="tk-fn">process</span>(data):</div>
          <div className="hero-bad">&nbsp;&nbsp;result = <span className="tk-fn">eval</span>(data)</div>
          <div>&nbsp;&nbsp;<span className="tk-kw">return</span> result</div>
          <span className="hero-chip">AC004 · Критична</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h2>{title}</h2>
          <p className="muted">{subtitle}</p>
          {children}
          <p className="auth-footer">{footer}</p>
        </div>
      </section>
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

  if (user) return <Navigate to="/dashboard" replace />;

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
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="З поверненням!" subtitle="Увійдіть, щоб продовжити роботу"
      footer={<>Немає облікового запису? <Link to="/register">Зареєструватися</Link></>}>
      <form onSubmit={submit} noValidate>
        <FormField label="Email" error={errors.email}>
          {(id, err) => <input id={id} type="email" autoComplete="username" value={form.email} onChange={set("email")}
            aria-describedby={err} placeholder="name@example.com" />}
        </FormField>
        <FormField label="Пароль" error={errors.password}>
          {(id, err) => <input id={id} type="password" autoComplete="current-password" value={form.password}
            onChange={set("password")} aria-describedby={err} placeholder="••••••••" />}
        </FormField>
        {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
        <Button type="submit" loading={loading} className="btn-block btn-lg">Увійти</Button>
      </form>
      <div className="demo-box">
        <strong>Демо-акаунти</strong>
        <span className="muted small">{USE_BACKEND ? "Тестові облікові записи сервера. Натисніть роль, щоб заповнити форму:" : "Бекенд не підключено. Натисніть роль, щоб заповнити форму:"}</span>
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

  if (user) return <Navigate to="/dashboard" replace />;
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
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Створення облікового запису" subtitle="Це займе менше хвилини"
      footer={<>Уже є обліковий запис? <Link to="/login">Увійти</Link></>}>
      <form onSubmit={submit} noValidate>
        <FormField label="Email" error={errors.email}>
          {(id, err) => <input id={id} type="email" autoComplete="username" value={form.email} onChange={set("email")} aria-describedby={err} placeholder="name@example.com" />}
        </FormField>
        <FormField label="Пароль" error={errors.password} hint="Щонайменше 6 символів">
          {(id, err) => <input id={id} type="password" autoComplete="new-password" value={form.password} onChange={set("password")} aria-describedby={err} />}
        </FormField>
        <FormField label="Підтвердження пароля" error={errors.confirm}>
          {(id, err) => <input id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} aria-describedby={err} />}
        </FormField>
        {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
        <Button type="submit" loading={loading} className="btn-block btn-lg">Створити обліковий запис</Button>
      </form>
    </AuthShell>
  );
}
