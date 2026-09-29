import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { analysesApi } from "../api/mockApi.js";
import { SAMPLE_CODE } from "../api/seed.js";
import { useToast } from "../context/ToastContext.jsx";
import { MAX_FILE_BYTES } from "../utils/validation.js";
import Card from "../components/common/Card.jsx";
import Button from "../components/common/Button.jsx";
import FormField from "../components/common/FormField.jsx";

// Екран запуску аналізу: вставка фрагмента або завантаження .py-файлів.
export default function AnalyzePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInput = useRef(null);
  const [mode, setMode] = useState("snippet"); // "snippet" | "file"
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Читання вибраних файлів із перевіркою розширення й розміру (запобігання помилкам)
  const addFiles = async (list) => {
    const accepted = [];
    for (const f of Array.from(list)) {
      if (!f.name.endsWith(".py")) {
        toast.error(`Файл «${f.name}» пропущено: дозволені лише .py`);
      } else if (f.size > MAX_FILE_BYTES) {
        toast.error(`Файл «${f.name}» завеликий (максимум 1 МБ)`);
      } else {
        accepted.push({ path: f.name, content: await f.text() });
      }
    }
    setFiles((prev) => [...prev.filter((p) => !accepted.some((a) => a.path === p.path)), ...accepted]);
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = mode === "snippet" ? (code.trim() ? [{ path: "snippet.py", content: code }] : []) : files;
    if (payload.length === 0) {
      setError(mode === "snippet" ? "Введіть код або вставте приклад" : "Виберіть хоча б один файл .py");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const analysis = await analysesApi.create({
        title: title.trim() || (mode === "snippet" ? "Фрагмент коду" : payload[0].path),
        sourceType: mode === "snippet" ? "snippet" : "file",
        files: payload,
      }); // POST /api/analyses
      toast.success(analysis.status === "done" ? "Аналіз завершено" : "Аналіз завершено з помилкою розбору");
      navigate(`/report/${analysis.id}`);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="page-title">Новий аналіз</h1>
      <div className="grid-2">
        <Card title="Вихідний код">
          <form onSubmit={submit} noValidate>
            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={mode === "snippet"} className={`tab ${mode === "snippet" ? "tab-on" : ""}`} onClick={() => setMode("snippet")}>Фрагмент</button>
              <button type="button" role="tab" aria-selected={mode === "file"} className={`tab ${mode === "file" ? "tab-on" : ""}`} onClick={() => setMode("file")}>Файли .py</button>
              <button type="button" role="tab" className="tab" disabled title="Доступно після підключення бекенду">Архів .zip</button>
            </div>

            <FormField label="Назва аналізу" hint="Необов’язково">
              {(id) => <input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Наприклад, lab2_solution.py" maxLength={80} />}
            </FormField>

            {mode === "snippet" ? (
              <FormField label="Код Python">
                {(id) => (
                  <>
                    <textarea id={id} className="code-input" rows={14} spellCheck={false} value={code}
                      onChange={(e) => { setCode(e.target.value); setError(""); }} placeholder="Вставте код тут…" />
                    <div className="row-between">
                      <span className="muted small">Рядків: {code ? code.split("\n").length : 0}</span>
                      <Button type="button" variant="ghost" onClick={() => { setCode(SAMPLE_CODE); setError(""); }}>Вставити приклад</Button>
                    </div>
                  </>
                )}
              </FormField>
            ) : (
              <div>
                <div className={`dropzone ${dragging ? "dropzone-on" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                  onClick={() => fileInput.current?.click()} role="button" tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}>
                  <strong>Перетягніть файли сюди або натисніть для вибору</strong>
                  <span className="muted small">Лише .py, до 1 МБ кожен</span>
                  <input ref={fileInput} type="file" accept=".py" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                </div>
                {files.length > 0 && (
                  <ul className="file-list">
                    {files.map((f) => (
                      <li key={f.path}>
                        <span className="mono">{f.path}</span>
                        <span className="muted small">{f.content.split("\n").length} рядків</span>
                        <button type="button" className="icon-btn" aria-label={`Видалити ${f.path}`} onClick={() => setFiles((l) => l.filter((x) => x.path !== f.path))}>×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="form-actions">
              <Button type="submit" loading={loading}>{loading ? "Аналіз виконується…" : "Аналізувати"}</Button>
            </div>
          </form>
        </Card>

        <Card title="Як це працює">
          <ol className="steps">
            <li>Вставте код або завантажте файли .py.</li>
            <li>Код розбирається в абстрактне синтаксичне дерево (AST) і перевіряється за увімкненими правилами.</li>
            <li>Ви отримуєте зауваження, метрики та графіки; результат зберігається в історії.</li>
          </ol>
          <div className="alert alert-info">
            <strong>Демо-режим.</strong> Бекенд не підключено: аналіз виконується у браузері спрощеним алгоритмом, дані
            зберігаються лише у вашому браузері. Код нікуди не надсилається.
          </div>
        </Card>
      </div>
    </>
  );
}
