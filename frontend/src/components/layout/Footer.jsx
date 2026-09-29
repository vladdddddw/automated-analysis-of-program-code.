import { USE_BACKEND } from "../../api/index.js";

export default function Footer() {
  return (
    <footer className="footer">
      <span>© 2026 CodeInspector · автоматизований аналіз програмного коду</span>
      <span>{USE_BACKEND ? "Підключено до сервера · PostgreSQL" : "Демо-фронтенд · мокові дані"}</span>
    </footer>
  );
}
