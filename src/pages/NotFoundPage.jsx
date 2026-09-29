import { Link } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import { EmptyState } from "../components/common/Feedback.jsx";

export default function NotFoundPage() {
  return (
    <EmptyState title="Сторінку не знайдено" text="Перевірте адресу або поверніться на головну"
      action={<Link to="/analyze"><Button>На головну</Button></Link>} />
  );
}
