import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SEVERITIES } from "../../api/seed.js";
import { SeverityBadge } from "../common/Badge.jsx";
import { EmptyState } from "../common/Feedback.jsx";

// Таблиця зауважень: фільтр за серйозністю та правилом, пошук, сортування.
// Стан фільтрів локальний; вибраний рядок піднімається до батьківського компонента (onSelect).
export default function IssuesTable({ issues, selectedKey, onSelect }) {
  const [severity, setSeverity] = useState("all");
  const [rule, setRule] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "severity", dir: "desc" });

  const rules = useMemo(() => [...new Set(issues.map((i) => i.ruleId))].sort(), [issues]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = issues.filter(
      (i) =>
        (severity === "all" || i.severity === severity) &&
        (rule === "all" || i.ruleId === rule) &&
        (!q || i.message.toLowerCase().includes(q) || i.ruleId.toLowerCase().includes(q)),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      const va = sort.key === "severity" ? SEVERITIES[a.severity].rank : a[sort.key];
      const vb = sort.key === "severity" ? SEVERITIES[b.severity].rank : b[sort.key];
      return va > vb ? dir : va < vb ? -dir : a.line - b.line;
    });
  }, [issues, severity, rule, query, sort]);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  const arrow = (key) => (sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div>
      <div className="filters">
        <div className="chips" role="group" aria-label="Фільтр за серйозністю">
          <button className={`chip ${severity === "all" ? "chip-on" : ""}`} onClick={() => setSeverity("all")}>Усі</button>
          {Object.entries(SEVERITIES).reverse().map(([key, s]) => (
            <button key={key} className={`chip ${severity === key ? "chip-on" : ""}`} onClick={() => setSeverity(key)}>{s.label}</button>
          ))}
        </div>
        <div className="filter-inputs">
          <select value={rule} onChange={(e) => setRule(e.target.value)} aria-label="Фільтр за правилом">
            <option value="all">Усі правила</option>
            {rules.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <label className="search"><Search size={16} /><input type="search" placeholder="Пошук у зауваженнях…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Зауважень немає" text="Змініть фільтри або код не містить проблем" />
      ) : (
        <div className="table-wrap">
          <table className="table table-hover table-stack">
            <thead>
              <tr>
                <th>Файл</th>
                <th className="sortable" onClick={() => toggleSort("line")}>Рядок{arrow("line")}</th>
                <th>Правило</th>
                <th className="sortable" onClick={() => toggleSort("severity")}>Серйозність{arrow("severity")}</th>
                <th>Опис</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.key} className={i.key === selectedKey ? "row-selected" : ""} onClick={() => onSelect(i)} tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onSelect(i)}>
                  <td data-label="Файл" className="mono">{i.filePath}</td>
                  <td data-label="Рядок" className="num">{i.line}</td>
                  <td data-label="Правило" className="mono">{i.ruleId}</td>
                  <td data-label="Серйозність"><SeverityBadge severity={i.severity} /></td>
                  <td data-label="Опис">{i.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Показано {rows.length} з {issues.length}. Натисніть на рядок, щоб побачити місце в коді.</p>
    </div>
  );
}
