export const formatDate = (iso) =>
  new Date(iso).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const SOURCE_LABELS = { file: "Файл", archive: "Архів", snippet: "Фрагмент" };
export const STATUS_LABELS = { done: "Виконано", failed: "Помилка" };

export function downloadFile(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function reportToHtml(analysis, severities) {
  const rows = analysis.files
    .flatMap((f) => f.issues.map((i) => ({ file: f.path, ...i })))
    .map((i) => `<tr><td>${esc(i.file)}</td><td>${i.line}</td><td>${i.ruleId}</td><td>${esc(severities[i.severity].label)}</td><td>${esc(i.message)}</td></tr>`)
    .join("");
  return `<!doctype html><html lang="uk"><meta charset="utf-8"><title>${esc(analysis.title)}</title>
<style>body{font-family:Arial,sans-serif;margin:2rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#eee}</style>
<h1>Звіт: ${esc(analysis.title)}</h1><p>Дата: ${formatDate(analysis.createdAt)}. Файлів: ${analysis.files.length}.</p>
<table><tr><th>Файл</th><th>Рядок</th><th>Правило</th><th>Серйозність</th><th>Опис</th></tr>${rows}</table></html>`;
}
