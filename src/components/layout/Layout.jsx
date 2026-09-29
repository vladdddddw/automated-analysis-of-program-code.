import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { Spinner } from "../common/Feedback.jsx";
import Header from "./Header.jsx";
import Sidebar from "./Sidebar.jsx";
import Footer from "./Footer.jsx";

// Каркас застосунку для авторизованих користувачів: Header + Sidebar + MainContent + Footer.
export default function Layout() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (loading) return <Spinner label="Перевірка сесії…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="app-shell">
      <Header onMenu={() => setMenuOpen((v) => !v)} />
      <div className="app-body">
        <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
        <main className="main">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}
