import { useEffect } from "react";
import Button from "./Button.jsx";

export default function Modal({ title, onClose, children, footer }) {
  // Закриття по Esc – контроль користувача
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Закрити">×</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

// Підтвердження небезпечної дії (запобігання помилкам)
export function ConfirmModal({ title, text, confirmText = "Підтвердити", loading, onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Скасувати</Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>{confirmText}</Button>
        </>
      }
    >
      <p>{text}</p>
    </Modal>
  );
}
