import { Boxes, Database, Palette, Server, ShieldCheck, Workflow } from "lucide-react";
import Card from "../components/common/Card.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import { USE_BACKEND } from "../api/index.js";

const STACK = [
  { icon: Palette, title: "React + Vite", text: "Компонентний односторінковий застосунок, адаптивна верстка на CSS Grid/Flexbox." },
  { icon: Server, title: "FastAPI", text: USE_BACKEND ? "REST API на Python: автентифікація JWT, валідація, ролі, аналіз коду." : "REST API на Python; у цьому демо замінений мок-шаром з тією самою формою відповідей." },
  { icon: Workflow, title: "Аналіз AST", text: "Розбір Python-коду модулем ast, правила як окремі класи, метрики складності." },
  { icon: Database, title: "PostgreSQL", text: "Збереження користувачів, аналізів, файлів, функцій і зауважень (лабораторна № 5)." },
];

// Довідкова сторінка: призначення системи, стек і обмеження демо-версії.
export default function AboutPage() {
  return (
    <>
      <PageHeader title="Про систему" text="CodeInspector – вебзастосунок автоматизованого аналізу програмного коду" />
      <div className="feature-grid">
        {STACK.map(({ icon: Icon, title, text }) => (
          <div className="feature" key={title}>
            <span className="feature-ico"><Icon size={22} /></span>
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </div>
        ))}
      </div>
      <div className="grid-2 grid-even">
        <Card title="Що вміє система">
          <ul className="check-list">
            <li><ShieldCheck size={18} />10 правил перевірки: безпека, надійність, супроводжуваність, стиль</li>
            <li><ShieldCheck size={18} />Метрики: LOC, SLOC, цикломатична складність, вкладеність, параметри</li>
            <li><ShieldCheck size={18} />Оцінка якості 0–100, графіки, історія та порівняння аналізів</li>
            <li><ShieldCheck size={18} />Експорт звітів у JSON та HTML, ролі користувачів</li>
          </ul>
        </Card>
        <Card title={USE_BACKEND ? "Як це працює" : "Обмеження демо-версії"}>
          <div className="notice notice-flat">
            <Boxes size={18} />
            <div>{USE_BACKEND ? "Браузер надсилає код на сервер FastAPI, той розбирає його модулем ast (код не виконується), зберігає результат у PostgreSQL і повертає звіт." : "Бекенд ще не підключено. Дані мокові й зберігаються в localStorage вашого браузера; код аналізується спрощеним алгоритмом прямо на сторінці й нікуди не надсилається."}</div>
          </div>
        </Card>
      </div>
    </>
  );
}
