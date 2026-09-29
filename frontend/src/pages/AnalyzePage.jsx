import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Cpu, FileCode2, LineChart, Rocket, Trash2, UploadCloud, Wand2, X } from "lucide-react";
import { analysesApi, USE_BACKEND } from "../api/index.js";
import { SAMPLE_CODE } from "../api/seed.js";
import { useToast } from "../context/ToastContext.jsx";
import { MAX_FILE_BYTES } from "../utils/validation.js";
import Card from "../components/common/Card.jsx";
import Button from "../components/common/Button.jsx";
import FormField from "../components/common/FormField.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import Tabs from "../components/common/Tabs.jsx";

// Екран запуску аналізу: вставка фрагмента або завантаження .py-файлів.
export default function AnalyzePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInput = useRef(null);
  const [mode, setMode] = useState("snippet"); // "snippet" | "file"
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [files, setFiles] = useState([]);
  const [archive, setArchive] = useState(null); // вибраний .zip (лише з реальним бекендом)
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

  // Вибір архіву з перевіркою розширення й розміру
  const pickArchive = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".zip")) return toast.error("Дозволені лише архіви .zip");
    if (f.size > 10_000_000) return toast.error("Архів завеликий (максимум 10 МБ)");
    setArchive(f);
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = mode === "snippet" ? (code.trim() ? [{ path: "snippet.py", content: code }] : []) : mode === "file" ? files : [];
    if (mode === "archive" ? !archive : payload.length === 0) {
      setError(mode === "snippet" ? "Введіть код або вставте приклад" : mode === "file" ? "Виберіть хоча б один файл .py" : "Виберіть архів .zip");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const analysis = mode === "archive"
        ? await analysesApi.createFromArchive({ title: title.trim() || archive.name, file: archive }) // POST /api/analyses/archive
        : await analysesApi.create({
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
      <PageHeader title="Новий аналіз" text="Вставте код або завантажте файли – результат буде готовий за кілька секунд" />
      <div className="grid-2">
        <Card>
          <form onSubmit={submit} noValidate>
            <Tabs label="Тип джерела" active={mode} onChange={setMode}
              items={[
                { id: "snippet", label: "Фрагмент", icon: Wand2 },
                { id: "file", label: "Файли .py", icon: FileCode2 },
                ...(USE_BACKEND ? [{ id: "archive", label: "Архів .zip", icon: Archive }] : []),
              ]} />

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
                      <div className="row-gap">
                        {code && <Button type="button" variant="ghost" onClick={() => setCode("")}><Trash2 size={15} />Очистити</Button>}
                        <Button type="button" variant="ghost" onClick={() => { setCode(SAMPLE_CODE); setError(""); }}><Wand2 size={15} />Вставити приклад</Button>
                      </div>
                    </div>
                  </>
                )}
              </FormField>
            ) : mode === "archive" ? (
              <div>
                <div className={`dropzone ${dragging ? "dropzone-on" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); pickArchive(e.dataTransfer.files[0]); }}
                  onClick={() => fileInput.current?.click()} role="button" tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}>
                  <span className="drop-icon"><Archive size={30} /></span>
                  <strong>Перетягніть архів .zip сюди або натисніть для вибору</strong>
                  <span className="muted small">До 10 МБ; буде проаналізовано всі файли .py всередині</span>
                  <input ref={fileInput} type="file" accept=".zip" hidden onChange={(e) => { pickArchive(e.target.files[0]); e.target.value = ""; }} />
                </div>
                {archive && (
                  <ul className="file-list">
                    <li>
                      <Archive size={18} className="file-ico" />
                      <span className="mono grow">{archive.name}</span>
                      <span className="muted small">{(archive.size / 1024).toFixed(0)} КБ</span>
                      <button type="button" className="icon-btn" aria-label="Видалити архів" onClick={() => setArchive(null)}><X size={16} /></button>
                    </li>
                  </ul>
                )}
              </div>
            ) : (
              <div>
                <div className={`dropzone ${dragging ? "dropzone-on" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                  onClick={() => fileInput.current?.click()} role="button" tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}>
                  <span className="drop-icon"><UploadCloud size={30} /></span>
                  <strong>Перетягніть файли сюди або натисніть для вибору</strong>
                  <span className="muted small">Лише .py, до 1 МБ кожен</span>
                  <input ref={fileInput} type="file" accept=".py" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                </div>
                {files.length > 0 && (
                  <ul className="file-list">
                    {files.map((f) => (
                      <li key={f.path}>
                        <FileCode2 size={18} className="file-ico" />
                        <span className="mono grow">{f.path}</span>
                        <span className="muted small">{f.content.split("\n").length} рядків</span>
                        <button type="button" className="icon-btn" aria-label={`Видалити ${f.path}`} onClick={() => setFiles((l) => l.filter((x) => x.path !== f.path))}><X size={16} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="form-actions">
              <Button type="submit" loading={loading} className="btn-lg"><Rocket size={18} />{loading ? "Аналіз виконується…" : "Аналізувати"}</Button>
            </div>
          </form>
        </Card>

        <div className="stack">
          <Card title="Як це працює">
            <ol className="steps">
              <li><span className="step-ico"><FileCode2 size={18} /></span><div><strong>Завантаження</strong><span>Вставте код або додайте файли .py</span></div></li>
              <li><span className="step-ico"><Cpu size={18} /></span><div><strong>Розбір AST</strong><span>Код перетворюється на синтаксичне дерево й перевіряється за правилами</span></div></li>
              <li><span className="step-ico"><LineChart size={18} /></span><div><strong>Звіт</strong><span>Зауваження, метрики, графіки та поради збережуться в історії</span></div></li>
            </ol>
          </Card>
          <div className="notice">
            <Archive size={18} />
            {USE_BACKEND
              ? <div><strong>Код не виконується.</strong> Сервер лише розбирає його в синтаксичне дерево (AST) та перевіряє за правилами. Результат зберігається в базі даних.</div>
              : <div><strong>Демо-режим.</strong> Бекенд не підключено: аналіз виконується у браузері спрощеним алгоритмом, дані зберігаються лише у вашому браузері. Код нікуди не надсилається.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
