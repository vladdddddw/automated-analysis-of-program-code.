import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { ROLE_LABELS } from "../../api/seed.js";

const TITLES = [
  ["/dashboard", "Панель керування"],
  ["/analyze", "Новий аналіз"],
  ["/report", "Звіт про аналіз"],
  ["/history", "Історія аналізів"],
  ["/rules", "Правила перевірки"],
  ["/about", "Про систему"],
];

// Верхня панель: назва розділу, перемикач теми, відомості про користувача, вихід.
export default function Header({ onMenu }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const title = TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? "CodeInspector";
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Відкрити меню"><Menu size={22} /></button>
      <h2 className="topbar-title">{title}</h2>
      <div className="grow" />
      <span className="demo-tag" title="Усі дані моковані, бекенд не підключено">DEMO</span>
      <button className="icon-btn round" onClick={toggle} aria-label="Змінити тему" title={theme === "dark" ? "Світла тема" : "Темна тема"}>
        {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      {user && (
        <div className="user-chip">
          <span className="avatar">{initials}</span>
          <span className="user-meta">
            <span className="user-email">{user.email}</span>
            <span className="user-role">{ROLE_LABELS[user.role]}</span>
          </span>
        </div>
      )}
      <button className="icon-btn round" onClick={() => { logout(); navigate("/login"); }} aria-label="Вийти" title="Вийти">
        <LogOut size={19} />
      </button>
    </header>
  );
}
