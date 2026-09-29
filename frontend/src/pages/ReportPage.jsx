import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bug, Code2, FileCode2, Layers, LayoutGrid, Lightbulb, Trash2 } from "lucide-react";
import { analysesApi, rulesApi } from "../api/index.js";
import { useAsync } from "../hooks/useAsync.js";
import { useToast } from "../context/ToastContext.jsx";
import { formatDate, SOURCE_LABELS } from "../utils/format.js";
import { qualityScore } from "../utils/score.js";
import Card from "../components/common/Card.jsx";
import Button from "../components/common/Button.jsx";
import StatCard from "../components/common/StatCard.jsx";
import Tabs from "../components/common/Tabs.jsx";
import ScoreRing from "../components/common/ScoreRing.jsx";
import { StatusBadge, SeverityBadge } from "../components/common/Badge.jsx";
import { ConfirmModal } from "../components/common/Modal.jsx";
import { EmptyState, ErrorState, Spinner } from "../components/common/Feedback.jsx";
import { ComplexityChart, SeverityDonut } from "../components/report/Charts.jsx";
import IssuesTable from "../components/report/IssuesTable.jsx";
import CodeViewer from "../components/report/CodeViewer.jsx";
import ExportButtons from "../components/report/ExportButtons.jsx";

// Екран звіту: вкладки «Огляд», «Зауваження», «Код», «Функції».
// Стан: вибране зауваження (selected) визначає активний файл і підсвічений рядок у коді.
export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: analysis, loading, error, reload } = useAsync(() => analysesApi.get(id), [id]); // GET /api/analyses/{id}
  const { data: rules } = useAsync(() => rulesApi.list(), []); // GET /api/rules
  const [tab, setTab] = useState("overview");
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
  const functions = analysis.files.flatMap((f) => f.functions.map((fn) => ({ ...fn, file: f.path })));
  const maxComplexity = Math.max(0, ...analysis.files.map((f) => f.maxComplexity));
  const syntaxErrors = analysis.files.filter((f) => f.syntaxError);
  const counts = Object.fromEntries(["critical", "high", "medium", "low", "info"].map((k) => [k, issues.filter((i) => i.severity === k).length]));
  const score = analysis.status === "done" ? qualityScore(issues) : null;
  const rule = selected && rules ? rules.find((r) => r.id === selected.ruleId) : null;
  const cxThreshold = rules?.find((r) => r.id === "AC006")?.threshold ?? 10;

  const onSelect = (issue) => {
    setSelected(issue);
    setFileIdx(issue.fileIndex);
    setTab("code"); // показуємо місце зауваження в коді
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
      <Link to="/history" className="back-link"><ArrowLeft size={15} />До історії</Link>

      <section className="report-hero">
        <div className="report-hero-main">
          <div className="report-file-ico"><FileCode2 size={26} /></div>
          <div>
            <h1 className="page-title">{analysis.title}</h1>
            <p className="report-meta">
              <span>{formatDate(analysis.createdAt)}</span><i />
              <span>{SOURCE_LABELS[analysis.sourceType]}</span><i />
              <span>{analysis.owner}</span><i />
              <StatusBadge status={analysis.status} />
            </p>
            <div className="report-actions">
              <ExportButtons analysis={analysis} />
              <Button variant="danger-soft" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Видалити</Button>
            </div>
          </div>
        </div>
        <ScoreRing score={score} size={128} stroke={11} />
      </section>

      {syntaxErrors.map((f) => (
        <div key={f.path} className="alert alert-error" role="alert"><strong>{f.path}:</strong> {f.syntaxError}</div>
      ))}

      <Tabs active={tab} onChange={setTab} label="Розділи звіту" items={[
        { id: "overview", label: "Огляд", icon: LayoutGrid },
        { id: "issues", label: "Зауваження", icon: Bug, count: issues.length },
        { id: "code", label: "Код", icon: Code2 },
        { id: "functions", label: "Функції", icon: Layers, count: functions.length },
      ]} />

      {tab === "overview" && (
        <>
          <div className="stats">
            <StatCard label="Зауважень" value={issues.length} icon={Bug} tone={issues.length ? "amber" : "emerald"} />
            <StatCard label="Файлів" value={analysis.files.length} icon={FileCode2} tone="indigo" />
            <StatCard label="Макс. складність" value={maxComplexity} icon={Layers} tone={maxComplexity > cxThreshold ? "rose" : "sky"} />
            <StatCard label="Час аналізу, мс" value={analysis.durationMs} icon={Lightbulb} tone="violet" />
          </div>
          <div className="grid-2 grid-even">
            <Card title="Зауваження за серйозністю"><SeverityDonut counts={counts} /></Card>
            <Card title="Цикломатична складність функцій" subtitle={`Вертикальна риска – поріг (${cxThreshold})`}>
              <ComplexityChart functions={functions} threshold={cxThreshold} />
            </Card>
          </div>
        </>
      )}

      {tab === "issues" && (
        <Card title="Список зауважень">
          <IssuesTable issues={issues} selectedKey={selected?.key} onSelect={onSelect} />
        </Card>
      )}

      {tab === "code" && (
        <div className="code-layout">
          <div>
            {analysis.files.length > 1 && (
              <div className="file-switch">
                <select value={fileIdx} onChange={(e) => { setFileIdx(Number(e.target.value)); setSelected(null); }} aria-label="Файл">
                  {analysis.files.map((f, i) => <option key={f.path} value={i}>{f.path}</option>)}
                </select>
              </div>
            )}
            <CodeViewer file={file} activeLine={selected && selected.fileIndex === fileIdx ? selected.line : null} />
          </div>
          <aside className="advice">
            <h3><Lightbulb size={18} />Рекомендація</h3>
            {selected ? (
              <>
                <p className="advice-head"><SeverityBadge severity={selected.severity} /> <span className="mono">{selected.ruleId}</span></p>
                <p><strong>{rule?.name}</strong></p>
                <p className="muted">{selected.message}, рядок {selected.line}</p>
                <p className="advice-text">{rule?.recommendation}</p>
              </>
            ) : (
              <p className="muted">Виберіть зауваження у вкладці «Зауваження», щоб побачити пораду щодо виправлення. Рядки з проблемами підсвічено кольором.</p>
            )}
          </aside>
        </div>
      )}

      {tab === "functions" && (
        <Card title="Метрики функцій">
          {functions.length === 0 ? (
            <EmptyState title="Функцій не знайдено" />
          ) : (
            <div className="table-wrap">
              <table className="table table-stack">
                <thead>
                  <tr><th>Функція</th><th>Файл</th><th>Рядки</th><th className="num">Складність</th><th className="num">Вкладеність</th><th className="num">Параметрів</th></tr>
                </thead>
                <tbody>
                  {[...functions].sort((a, b) => b.complexity - a.complexity).map((f, i) => (
                    <tr key={`${f.name}-${i}`}>
                      <td data-label="Функція" className="mono"><strong>{f.name}</strong></td>
                      <td data-label="Файл" className="mono">{f.file}</td>
                      <td data-label="Рядки">{f.startLine}–{f.endLine}</td>
                      <td data-label="Складність" className="num"><span className={`pill ${f.complexity > cxThreshold ? "pill-bad" : "pill-ok"}`}>{f.complexity}</span></td>
                      <td data-label="Вкладеність" className="num">{f.nestingDepth}</td>
                      <td data-label="Параметрів" className="num">{f.params}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {confirmDelete && (
        <ConfirmModal title="Видалити аналіз?" text={`Аналіз «${analysis.title}» буде видалено разом зі звітом. Цю дію не можна скасувати.`}
          confirmText="Видалити" loading={deleting} onConfirm={doDelete} onClose={() => setConfirmDelete(false)} />
      )}
    </>
  );
}
