import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import Layout from "./components/layout/Layout.jsx";
import { LoginPage, RegisterPage } from "./pages/AuthPages.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import AnalyzePage from "./pages/AnalyzePage.jsx";
import ReportPage from "./pages/ReportPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import RulesPage from "./pages/RulesPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

// HashRouter потрібен для GitHub Pages: сторінка не перезавантажується з 404 за глибоких посилань.
export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/analyze" element={<AnalyzePage />} />
                <Route path="/report/:id" element={<ReportPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/rules" element={<RulesPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
