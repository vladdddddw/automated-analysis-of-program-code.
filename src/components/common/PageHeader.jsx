// Заголовок сторінки: назва, опис і кнопки дій праворуч
export default function PageHeader({ title, text, children }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {text && <p className="page-text">{text}</p>}
      </div>
      {children && <div className="head-actions">{children}</div>}
    </div>
  );
}
