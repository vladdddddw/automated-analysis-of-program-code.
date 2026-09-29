import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, FileCode2, GitCompare, Plus, Search, Trash2, Wand2 } from "lucide-react";
import { analysesApi } from "../api/mockApi.js";
import { useAsync } from "../hooks/useAsync.js";
import { useToast } from "../context/ToastContext.jsx";
import { formatDate, SOURCE_LABELS } from "../utils/format.js";
import Card from "../components/common/Card.jsx";
import Button from "../components/common/Button.jsx";
import Modal, { ConfirmModal } from "../components/common/Modal.jsx";
import Pagination from "../components/common/Pagination.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import ScoreRing from "../components/common/ScoreRing.jsx";
import { StatusBadge } from "../components/common/Badge.jsx";
import { EmptyState, ErrorState, Spinner } from "../components/common/Feedback.jsx";

const PAGE_SIZE = 5;
const SOURCE_ICONS = { file: FileCode2, archive: Archive, snippet: Wand2 };

// Екран зі списком даних: пошук, фільтри, сортування, пагінація, видалення, порівняння двох аналізів.
export default function HistoryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => analysesApi.list(), []); // GET /api/analyses
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState([]); // id аналізів для порівняння (максимум 2)
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [compare, setCompare] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data
      .filter((a) => (status === "all" || a.status === status) && (source === "all" || a.sourceType === source) && (!q || a.title.toLowerCase().includes(q)))
      .sort((a, b) => (sortDesc ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
  }, [data, query, status, source, sortDesc]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const resetPage = (setter) => (e) => { setter(e.target.value); setPage(1); };
  const togglePick = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 2 ? [...p, id] : [p[1], id]));

  const doDelete = async () => {
    setDeleting(true);
    try {
      await analysesApi.remove(toDelete.id); // DELETE /api/analyses/{id}
      toast.success("Аналіз видалено");
      setPicked((p) => p.filter((x) => x !== toDelete.id));
      setToDelete(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const pair = compare ? picked.map((id) => data.find((a) => a.id === id)) : [];

  return (
    <>
      <PageHeader title="Історія аналізів" text="Усі запуски аналізу: пошук, порівняння та видалення">
        <Button variant="secondary" disabled={picked.length !== 2} onClick={() => setCompare(true)}><GitCompare size={16} />Порівняти ({picked.length}/2)</Button>
        <Link to="/analyze"><Button><Plus size={17} />Новий аналіз</Button></Link>
      </PageHeader>

      <Card>
        <div className="filters">
          <label className="search"><Search size={16} /><input type="search" placeholder="Пошук за назвою…" value={query} onChange={resetPage(setQuery)} aria-label="Пошук" /></label>
          <div className="filter-inputs">
            <select value={status} onChange={resetPage(setStatus)} aria-label="Статус">
              <option value="all">Усі статуси</option>
              <option value="done">Виконано</option>
              <option value="failed">Помилка</option>
            </select>
            <select value={source} onChange={resetPage(setSource)} aria-label="Тип джерела">
              <option value="all">Усі джерела</option>
              <option value="file">Файл</option>
              <option value="archive">Архів</option>
              <option value="snippet">Фрагмент</option>
            </select>
          </div>
        </div>

        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && rows.length === 0 && (
          <EmptyState title="Аналізів не знайдено" text="Змініть фільтри або запустіть новий аналіз"
            action={<Link to="/analyze"><Button>Новий аналіз</Button></Link>} />
        )}
        {!loading && !error && rows.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table table-hover table-stack">
                <thead>
                  <tr>
                    <th aria-label="Вибір" />
                    <th>Аналіз</th>
                    <th className="sortable" onClick={() => setSortDesc((v) => !v)}>Дата {sortDesc ? "▼" : "▲"}</th>
                    <th>Оцінка</th>
                    <th className="num">Файлів</th>
                    <th className="num">Зауважень</th>
                    <th>Статус</th>
                    <th aria-label="Дії" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((a) => {
                    const Icon = SOURCE_ICONS[a.sourceType];
                    return (
                      <tr key={a.id} onClick={() => navigate(`/report/${a.id}`)}>
                        <td data-label="Порівняння" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={picked.includes(a.id)} onChange={() => togglePick(a.id)} aria-label={`Вибрати ${a.title}`} />
                        </td>
                        <td data-label="Аналіз">
                          <div className="cell-title">
                            <span className="cell-ico"><Icon size={18} /></span>
                            <span><strong>{a.title}</strong><span className="muted small block">{SOURCE_LABELS[a.sourceType]} · {a.owner}</span></span>
                          </div>
                        </td>
                        <td data-label="Дата">{formatDate(a.createdAt)}</td>
                        <td data-label="Оцінка"><ScoreRing score={a.score} size={40} stroke={5} showLabel={false} /></td>
                        <td data-label="Файлів" className="num">{a.filesCount}</td>
                        <td data-label="Зауважень" className="num">{a.issuesCount}</td>
                        <td data-label="Статус"><StatusBadge status={a.status} /></td>
                        <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                          <button className="icon-btn danger" onClick={() => setToDelete(a)} aria-label={`Видалити ${a.title}`} title="Видалити"><Trash2 size={17} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={current} pages={pages} onChange={setPage} />
          </>
        )}
      </Card>

      {toDelete && (
        <ConfirmModal title="Видалити аналіз?" text={`Аналіз «${toDelete.title}» буде видалено безповоротно.`} confirmText="Видалити"
          loading={deleting} onConfirm={doDelete} onClose={() => setToDelete(null)} />
      )}

      {compare && pair.length === 2 && pair.every(Boolean) && (
        <Modal title="Порівняння аналізів" onClose={() => setCompare(false)} footer={<Button onClick={() => setCompare(false)}>Закрити</Button>}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Показник</th><th>{pair[0].title}</th><th>{pair[1].title}</th><th className="num">Зміна</th></tr></thead>
              <tbody>
                {[["Оцінка якості", "score", true], ["Зауважень", "issuesCount"], ["Макс. складність", "maxComplexity"], ["Час аналізу, мс", "durationMs"]].map(([label, key, higherBetter]) => {
                  const a = pair[0][key] ?? 0;
                  const b = pair[1][key] ?? 0;
                  const d = b - a;
                  const good = higherBetter ? d > 0 : d < 0;
                  return (
                    <tr key={key}>
                      <td>{label}</td><td className="num">{pair[0][key] ?? "—"}</td><td className="num">{pair[1][key] ?? "—"}</td>
                      <td className={`num ${d === 0 ? "" : good ? "delta-good" : "delta-bad"}`}>{d > 0 ? `+${d}` : d}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small">Зелена зміна означає покращення: вища оцінка, менше зауважень і нижча складність.</p>
        </Modal>
      )}
    </>
  );
}
