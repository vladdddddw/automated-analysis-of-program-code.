import { Link } from "react-router-dom";
import Button from "../components/common/Button.jsx";

export default function NotFoundPage() {
  return (
    <div className="not-found">
      <span className="nf-code">404</span>
      <h1>Сторінку не знайдено</h1>
      <p className="muted">Перевірте адресу або поверніться на головну</p>
      <Link to="/dashboard"><Button>На головну</Button></Link>
    </div>
  );
}
