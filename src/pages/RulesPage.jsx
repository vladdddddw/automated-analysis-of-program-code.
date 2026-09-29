import { useEffect, useState } from "react";
import { rulesApi } from "../api/mockApi.js";
import { CATEGORIES } from "../api/seed.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Card from "../components/common/Card.jsx";
import Button from "../components/common/Button.jsx";
import { SeverityBadge } from "../components/common/Badge.jsx";
import { ConfirmModal } from "../components/common/Modal.jsx";
import { ErrorState, Spinner } from "../components/common/Feedback.jsx";
import RuleForm from "../components/rules/RuleForm.jsx";

// Каталог правил. Редагувати може лише адміністратор (форма + перемикач з оптимістичним оновленням).
export default function RulesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === "admin";
  const { data, loading, error, reload } = useAsync(() => rulesApi.list(), []); // GET /api/rules
  const [rules, setRules] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (data) setRules(data);
  }, [data]);

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
      <div className="page-head">
        <h1 className="page-title">Правила перевірки</h1>
        {isAdmin && <Button variant="secondary" onClick={() => setConfirmReset(true)}>Скинути до типових</Button>}
      </div>
      {!isAdmin && <div className="alert alert-info">Перегляд доступний усім користувачам, змінювати правила може лише адміністратор (увійдіть як admin@example.com).</div>}

      <Card>
        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr><th>Код</th><th>Правило</th><th>Категорія</th><th>Серйозність</th><th>Поріг</th><th>Стан</th>{isAdmin && <th aria-label="Дії" />}</tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className={r.enabled ? "" : "row-off"}>
                    <td data-label="Код" className="mono">{r.id}</td>
                    <td data-label="Правило"><strong>{r.name}</strong><div className="muted small">{r.description}</div></td>
                    <td data-label="Категорія">{CATEGORIES[r.category]}</td>
                    <td data-label="Серйозність"><SeverityBadge severity={r.severity} /></td>
                    <td data-label="Поріг" className="num">{r.threshold ?? "—"}</td>
                    <td data-label="Стан">
                      <label className="switch" title={isAdmin ? "Увімкнути/вимкнути" : "Лише перегляд"}>
                        <input type="checkbox" checked={r.enabled} disabled={!isAdmin} onChange={(e) => save(r, { enabled: e.target.checked })} aria-label={`Правило ${r.id}`} />
                        <span className="slider" />
                      </label>
                    </td>
                    {isAdmin && <td className="actions-cell"><Button variant="ghost" onClick={() => setEditing(r)}>Редагувати</Button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <RuleForm rule={editing} saving={saving} onSave={submitForm} onClose={() => setEditing(null)} />}
      {confirmReset && (
        <ConfirmModal title="Скинути правила?" text="Усі правила буде повернено до типових значень (увімкнено, стандартні пороги)."
          confirmText="Скинути" loading={saving} onConfirm={reset} onClose={() => setConfirmReset(false)} />
      )}
    </>
  );
}
