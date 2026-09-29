import { NavLink } from "react-router-dom";

const LINKS = [
  { to: "/analyze", icon: "▶", label: "Новий аналіз" },
  { to: "/history", icon: "☰", label: "Історія аналізів" },
  { to: "/rules", icon: "⚙", label: "Правила перевірки" },
];

// Бічне меню. На вузьких екранах відкривається поверх сторінки (open = true).
export default function Sidebar({ open, onNavigate }) {
  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onNavigate} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <nav aria-label="Основна навігація">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={onNavigate}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <span className="nav-icon" aria-hidden="true">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
