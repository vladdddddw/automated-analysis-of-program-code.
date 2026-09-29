import Button from "./Button.jsx";

export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Сторінки">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Назад</Button>
      <span>Сторінка {page} з {pages}</span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Далі ›</Button>
    </nav>
  );
}
