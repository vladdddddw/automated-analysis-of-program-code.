import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLE_LABELS } from "../../api/seed.js";
import Button from "../common/Button.jsx";

// Шапка: логотип, кнопка меню (мобільна версія), відомості про користувача, вихід.
export default function Header({ onMenu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="header">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Відкрити меню">☰</button>
      <div className="logo" onClick={() => navigate("/analyze")}>
        <span className="logo-mark">{"</>"}</span>
        <span className="logo-text">CodeInspector</span>
      </div>
      <div className="header-spacer" />
      <span className="demo-tag" title="Усі дані моковані, бекенд не підключено">DEMO</span>
      {user && (
        <div className="user-box">
          <div className="user-info">
            <span className="user-email">{user.email}</span>
            <span className="user-role">{ROLE_LABELS[user.role]}</span>
          </div>
          <Button variant="ghost" onClick={() => { logout(); navigate("/login"); }}>Вийти</Button>
        </div>
      )}
    </header>
  );
}
