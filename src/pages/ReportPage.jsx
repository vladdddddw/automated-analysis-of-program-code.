import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { analysesApi, rulesApi } from "../api/mockApi.js";
import { useAsync } from "../hooks/useAsync.js";
import { useToast } from "../context/ToastContext.jsx";
import { formatDate, SOURCE_LABELS } from "../utils/format.js";
import Card from "../components/common/Card.jsx";
import Button from "../components/common/Button.jsx";
import StatCard from "../components/common/StatCard.jsx";
import { StatusBadge, SeverityBadge } from "../components/common/Badge.jsx";
import { ConfirmModal } from "../components/common/Modal.jsx";
import { ErrorState, Spinner } from "../components/common/Feedback.jsx";
import { ComplexityChart, SeverityChart } from "../components/report/Charts.jsx";
import IssuesTable from "../components/report/IssuesTable.jsx";
import CodeViewer from "../components/report/CodeViewer.jsx";
import ExportButtons from "../components/report/ExportButtons.jsx";

// Екран звіту: підсумок, графіки, таблиця зауважень і перегляд коду.
// Стан: вибране зауваження (selected) визначає активний файл і підсвічений рядок у коді.
export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: analysis, loading, error, reload } = useAsync(() => analysesApi.get(id), [id]); // GET /api/analyses/{id}
  const { data: rules } = useAsync(() => rulesApi.list(), []); // GET /api/rules
  const [selected, setSelected] = useState(null);
  const [fileIdx, setFileIdx] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const issues = useMemo(
    () => (analysis ? analysis.files.flatMap((f, fi) => f.issues.map((i) => ({ ...i, key: `${fi}-${i.id}`, fileIndex: fi, filePath: f.path }))) : []),
    [analysis],
  );

  if (loading) return <Spinner label="Завантаження звіту…" />;
  if (error) return <ErrorState error={error} onRetry={error.status === 404 ? undefined : reload} />;

  const file = analysis.files[fileIdx] ?? analysis.files[0];
  const functions = analysis.files.flatMap((f) => f.functions);
  const maxComplexity = Math.max(0, ...analysis.files.map((f) => f.maxComplexity));
  const syntaxErrors = analysis.files.filter((f) => f.syntaxError);
  const rule = selected && rules ? rules.find((r) => r.id === selected.ruleId) : null;

  const onSelect = (issue) => {
    setSelected(issue);
    setFileIdx(issue.fileIndex);
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await analysesApi.remove(analysis.id); // DELETE /api/analyses/{id}
      toast.success("Аналіз видалено");
      navigate("/history");
    } catch (e) {
      toast.error(e.message);
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/history" className="back-link">← До історії</Link>
          <h1 className="page-title">{analysis.title}</h1>
          <p className="muted">
            {formatDate(analysis.createdAt)} · {SOURCE_LABELS[analysis.sourceType]} · {analysis.owner} · <StatusBadge status={analysis.status} />
          </p>
        </div>
        <div className="head-actions">
          <ExportButtons analysis={analysis} />
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>Видалити</Button>
        </div>
      </div>

      {syntaxErrors.map((f) => (
        <div key={f.path} className="alert alert-error" role="alert"><strong>{f.path}:</strong> {f.syntaxError}</div>
      ))}

      <div className="stats">
        <StatCard label="Зауважень" value={issues.length} tone={issues.length ? "tone-warn" : "tone-ok"} />
        <StatCard label="Файлів" value={analysis.files.length} />
        <StatCard label="Макс. складність" value={maxComplexity} tone={maxComplexity > 10 ? "tone-warn" : ""} />
        <StatCard label="Час аналізу, мс" value={analysis.durationMs} />
      </div>

      <div className="grid-2">
        <Card title="Зауваження за серйозністю"><SeverityChart issues={issues} /></Card>
        <Card title="Цикломатична складність функцій"><ComplexityChart functions={functions} threshold={rules?.find((r) => r.id === "AC006")?.threshold ?? 10} /></Card>
      </div>

      <Card title="Зауваження">
        <IssuesTable issues={issues} selectedKey={selected?.key} onSelect={onSelect} />
      </Card>

      <Card title="Код" actions={
        analysis.files.length > 1 && (
          <select value={fileIdx} onChange={(e) => { setFileIdx(Number(e.target.value)); setSelected(null); }} aria-label="Файл">
            {analysis.files.map((f, i) => <option key={f.path} value={i}>{f.path}</option>)}
          </select>
        )
      }>
        <div className="code-layout">
          <CodeViewer file={file} activeLine={selected && selected.fileIndex === fileIdx ? selected.line : null} />
          <aside className="advice">
            <h3>Рекомендація</h3>
            {selected ? (
              <>
                <p><SeverityBadge severity={selected.severity} /> <span className="mono">{selected.ruleId}</span></p>
                <p><strong>{rule?.name}</strong></p>
                <p>{selected.message}</p>
                <p className="advice-text">{rule?.recommendation}</p>
              </>
            ) : (
              <p className="muted">Виберіть зауваження в таблиці, щоб побачити пораду щодо виправлення.</p>
            )}
          </aside>
        </div>
      </Card>

      {confirmDelete && (
        <ConfirmModal title="Видалити аналіз?" text={`Аналіз «${analysis.title}» буде видалено разом зі звітом. Цю дію не можна скасувати.`}
          confirmText="Видалити" loading={deleting} onConfirm={doDelete} onClose={() => setConfirmDelete(false)} />
      )}
    </>
  );
}
