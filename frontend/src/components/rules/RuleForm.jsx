import { useState } from "react";
import { validateThreshold } from "../../utils/validation.js";
import FormField from "../common/FormField.jsx";
import Button from "../common/Button.jsx";
import Modal from "../common/Modal.jsx";

// Форма редагування правила: увімкнення та порогове значення (якщо воно передбачене правилом).
export default function RuleForm({ rule, saving, onSave, onClose }) {
  const [enabled, setEnabled] = useState(rule.enabled);
  const [threshold, setThreshold] = useState(rule.threshold ?? "");
  const [error, setError] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (rule.threshold !== null) {
      const err = validateThreshold(threshold);
      setError(err);
      if (err) return;
    }
    onSave({ enabled, ...(rule.threshold !== null ? { threshold: Number(threshold) } : {}) });
  };

  return (
    <Modal title={`${rule.id}: ${rule.name}`} onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Скасувати</Button>
          <Button type="submit" form="rule-form" loading={saving}>Зберегти</Button>
        </>
      }>
      <form id="rule-form" onSubmit={submit} noValidate>
        <p className="muted">{rule.description}</p>
        <label className="check">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Правило увімкнено
        </label>
        {rule.threshold !== null && (
          <FormField label="Порогове значення" error={error} hint="Ціле число від 1 до 500">
            {(id, err) => <input id={id} inputMode="numeric" value={threshold} onChange={(e) => { setThreshold(e.target.value); setError(null); }} aria-describedby={err} />}
          </FormField>
        )}
      </form>
    </Modal>
  );
}
