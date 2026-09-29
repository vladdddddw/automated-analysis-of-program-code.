import { NavLink } from "react-router-dom";
import { BookOpen, History, LayoutDashboard, PlayCircle, SlidersHorizontal, X } from "lucide-react";
import Logo from "../common/Logo.jsx";
import { USE_BACKEND } from "../../api/index.js";

const SECTIONS = [
  { title: "Огляд", links: [{ to: "/dashboard", icon: LayoutDashboard, label: "Панель" }] },
  {
    title: "Аналіз коду",
    links: [
      { to: "/analyze", icon: PlayCircle, label: "Новий аналіз" },
      { to: "/history", icon: History, label: "Історія аналізів" },
    ],
  },
  { title: "Налаштування", links: [{ to: "/rules", icon: SlidersHorizontal, label: "Правила перевірки" }] },
  { title: "Довідка", links: [{ to: "/about", icon: BookOpen, label: "Про систему" }] },
];

// Темна бічна панель. На вузьких екранах висувається поверх сторінки (open = true).
export default function Sidebar({ open, onClose }) {
  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Logo light />
          <button className="icon-btn sidebar-close" onClick={onClose} aria-label="Закрити меню"><X size={20} /></button>
        </div>
        <nav aria-label="Основна навігація">
          {SECTIONS.map((s) => (
            <div className="nav-section" key={s.title}>
              <span className="nav-title">{s.title}</span>
              {s.links.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                  <Icon size={19} strokeWidth={2} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-note">
          <strong>{USE_BACKEND ? "Сервер підключено" : "Демо-режим"}</strong>
          <span>{USE_BACKEND ? "Аналіз виконує бекенд на Python (ast), дані зберігаються в базі PostgreSQL." : "Бекенд не підключено, усі дані мокові й зберігаються лише у вашому браузері."}</span>
        </div>
      </aside>
    </>
  );
}
