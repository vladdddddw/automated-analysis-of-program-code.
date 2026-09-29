import { useEffect, useMemo, useState } from "react";
import { Bug, Lock, Paintbrush, Pencil, RotateCcw, ShieldAlert, Wrench, LayoutGrid } from "lucide-react";
import { rulesApi } from "../api/index.js";
import { CATEGORIES } from "../api/seed.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Button from "../components/common/Button.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import Tabs from "../components/common/Tabs.jsx";
import { SeverityBadge } from "../components/common/Badge.jsx";
import { ConfirmModal } from "../components/common/Modal.jsx";
import { ErrorState, Spinner } from "../components/common/Feedback.jsx";
import RuleForm from "../components/rules/RuleForm.jsx";

const CAT_ICONS = { security: ShieldAlert, reliability: Bug, maintainability: Wrench, style: Paintbrush };

// Каталог правил у вигляді карток із вкладками за категоріями.
// Редагувати може лише адміністратор (форма + перемикач з оптимістичним оновленням).
export default function RulesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === "admin";
  const { data, loading, error, reload } = useAsync(() => rulesApi.list(), []); // GET /api/rules
  const [rules, setRules] = useState([]);
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (data) setRules(data);
  }, [data]);

  const shown = useMemo(() => rules.filter((r) => category === "all" || r.category === category), [rules, category]);
  const count = (c) => rules.filter((r) => c === "all" || r.category === c).length;

  // PUT /api/rules/{id}: спочатку оновлюємо інтерфейс, у разі помилки повертаємо попередній стан
  const save = async (rule, patch) => {
    const before = rules;
    setRules((list) => list.map((r) => (r.id === rule.id ? { ...r, ...patch } : r)));
    try {
      await rulesApi.update(rule.id, patch);
      toast.success(`Правило ${rule.id} оновлено`);
      return true;
    } catch (e) {
      setRules(before);
      toast.error(e.message);
      return false;
    }
  };

  const submitForm = async (patch) => {
    setSaving(true);
    if (await save(editing, patch)) setEditing(null);
    setSaving(false);
  };

  const reset = async () => {
    setSaving(true);
    try {
      setRules(await rulesApi.reset());
      toast.success("Правила повернено до типових значень");
      setConfirmReset(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Правила перевірки" text="Що саме шукає аналізатор і за якими порогами">
        {isAdmin && <Button variant="secondary" onClick={() => setConfirmReset(true)}><RotateCcw size={16} />Скинути до типових</Button>}
      </PageHeader>
      {!isAdmin && (
        <div className="notice"><Lock size={18} /><div>Перегляд доступний усім, змінювати правила може лише адміністратор (увійдіть як <b>admin@example.com</b>).</div></div>
      )}

      <Tabs label="Категорії правил" active={category} onChange={setCategory} items={[
        { id: "all", label: "Усі", icon: LayoutGrid, count: count("all") },
        ...Object.entries(CATEGORIES).map(([id, label]) => ({ id, label, icon: CAT_ICONS[id], count: count(id) })),
      ]} />

      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="rule-grid">
          {shown.map((r) => {
            const Icon = CAT_ICONS[r.category];
            return (
              <article key={r.id} className={`rule-card ${r.enabled ? "" : "rule-off"}`}>
                <header>
                  <span className={`rule-ico cat-${r.category}`}><Icon size={20} /></span>
                  <div className="grow">
                    <span className="mono rule-id">{r.id}</span>
                    <h3>{r.name}</h3>
                  </div>
                  <label className="switch" title={isAdmin ? "Увімкнути/вимкнути" : "Лише перегляд"}>
                    <input type="checkbox" checked={r.enabled} disabled={!isAdmin} onChange={(e) => save(r, { enabled: e.target.checked })} aria-label={`Правило ${r.id}`} />
                    <span className="slider" />
                  </label>
                </header>
                <p className="muted">{r.description}</p>
                <footer>
                  <SeverityBadge severity={r.severity} />
                  <span className="pill">{CATEGORIES[r.category]}</span>
                  {r.threshold !== null && <span className="pill pill-th">поріг {r.threshold}</span>}
                  <span className="grow" />
                  {isAdmin && <button className="icon-btn" onClick={() => setEditing(r)} aria-label={`Редагувати ${r.id}`} title="Редагувати"><Pencil size={16} /></button>}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {editing && <RuleForm rule={editing} saving={saving} onSave={submitForm} onClose={() => setEditing(null)} />}
      {confirmReset && (
        <ConfirmModal title="Скинути правила?" text="Усі правила буде повернено до типових значень (увімкнено, стандартні пороги)."
          confirmText="Скинути" loading={saving} onConfirm={reset} onClose={() => setConfirmReset(false)} />
      )}
    </>
  );
}
