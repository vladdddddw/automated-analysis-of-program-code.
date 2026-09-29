import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, BarChart3, FileCode2, Gauge, PlayCircle } from "lucide-react";
import { analysesApi } from "../api/mockApi.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatDate, SOURCE_LABELS } from "../utils/format.js";
import { scoreMeta } from "../utils/score.js";
import Card from "../components/common/Card.jsx";
import Button from "../components/common/Button.jsx";
import StatCard from "../components/common/StatCard.jsx";
import ScoreRing from "../components/common/ScoreRing.jsx";
import { EmptyState, ErrorState, Spinner } from "../components/common/Feedback.jsx";
import { SeverityDonut, TimelineChart, TopRules } from "../components/report/Charts.jsx";

// Панель керування: зведена статистика, діаграми та останні аналізи.
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => analysesApi.stats(), []); // GET /api/stats

  if (loading) return <Spinner label="Завантаження панелі…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const name = user.email.split("@")[0];
  const meta = scoreMeta(data.avgScore);

  return (
    <>
      <section className="banner">
        <div className="banner-text">
          <span className="banner-pill">Вітаємо, {name}</span>
          <h1>Перевірте якість свого коду за кілька секунд</h1>
          <p>Завантажте Python-файл або вставте фрагмент – система знайде проблеми, порахує метрики та підкаже, як їх виправити.</p>
          <div className="banner-actions">
            <Button variant="light" onClick={() => navigate("/analyze")}><PlayCircle size={18} />Новий аналіз</Button>
            <Button variant="glass" onClick={() => navigate("/history")}>Історія аналізів</Button>
          </div>
        </div>
        <div className="banner-ring">
          <ScoreRing score={data.avgScore} size={132} stroke={11} />
          <span>Середня оцінка якості</span>
        </div>
      </section>

      <div className="stats">
        <StatCard label="Аналізів" value={data.total} icon={FileCode2} tone="indigo" note={`${data.doneCount} успішних`} />
        <StatCard label="Зауважень" value={data.issues} icon={BarChart3} tone="amber" note="за всіма аналізами" />
        <StatCard label="Серйозних" value={data.critical} icon={AlertTriangle} tone="rose" note="критичні та високі" />
        <StatCard label="Оцінка якості" value={data.avgScore ?? "—"} icon={Gauge} tone="emerald" note={meta.label} />
      </div>

      <div className="grid-2 grid-even">
        <Card title="Зауваження за серйозністю" subtitle="Розподіл за всіма аналізами">
          <SeverityDonut counts={data.severity} />
        </Card>
        <Card title="Динаміка зауважень" subtitle="Кількість зауважень в аналізах">
          <TimelineChart points={data.timeline} />
        </Card>
      </div>

      <div className="grid-2 grid-even">
        <Card title="Найчастіші правила" subtitle="Що порушують найбільше">
          <TopRules items={data.topRules} />
        </Card>
        <Card title="Останні аналізи" actions={<Link to="/history" className="link-more">Усі <ArrowRight size={15} /></Link>}>
          {data.recent.length === 0 ? (
            <EmptyState title="Аналізів ще немає" action={<Link to="/analyze"><Button>Новий аналіз</Button></Link>} />
          ) : (
            <ul className="recent">
              {data.recent.map((a) => (
                <li key={a.id}>
                  <Link to={`/report/${a.id}`} className="recent-item">
                    <ScoreRing score={a.score} size={46} stroke={5} showLabel={false} />
                    <span className="recent-info">
                      <strong>{a.title}</strong>
                      <span className="muted small">{formatDate(a.createdAt)} · {SOURCE_LABELS[a.sourceType]}</span>
                    </span>
                    <span className="recent-count">{a.issuesCount}<small>зауваж.</small></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
