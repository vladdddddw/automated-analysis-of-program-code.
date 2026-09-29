import { useEffect, useMemo, useRef } from "react";
import { SEVERITIES } from "../../api/seed.js";

const KEYWORDS = new Set(["def", "class", "return", "if", "elif", "else", "for", "while", "import", "from", "as", "try", "except",
  "finally", "with", "in", "not", "and", "or", "is", "pass", "raise", "lambda", "yield", "break", "continue", "global", "assert"]);
const CONSTS = new Set(["None", "True", "False"]);
const TOKEN_RE = /(#.*$)|("""[^"]*"""|'''[^']*'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g;

// Проста підсвітка синтаксису Python: коментарі, рядки, числа, ключові слова, імена функцій
function highlight(line) {
  const out = [];
  let last = 0;
  let prev = "";
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [text, comment, str, num, word] = m;
    let cls = null;
    if (comment) cls = "tk-com";
    else if (str) cls = "tk-str";
    else if (num) cls = "tk-num";
    else if (KEYWORDS.has(word)) cls = "tk-kw";
    else if (CONSTS.has(word)) cls = "tk-const";
    else if (prev === "def" || prev === "class") cls = "tk-fn";
    out.push(cls ? <span key={m.index} className={cls}>{text}</span> : text);
    if (word) prev = word;
    last = m.index + text.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

// Перегляд коду з підсвіченням рядків із зауваженнями; активний рядок прокручується в зону видимості.
export default function CodeViewer({ file, activeLine }) {
  const activeRef = useRef(null);
  const boxRef = useRef(null);
  const lines = useMemo(() => file.content.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n"), [file.content]);

  // найсерйозніше зауваження для кожного рядка
  const worst = useMemo(() => {
    const map = new Map();
    file.issues.forEach((i) => {
      const prev = map.get(i.line);
      if (!prev || SEVERITIES[i.severity].rank > SEVERITIES[prev].rank) map.set(i.line, i.severity);
    });
    return map;
  }, [file.issues]);

  // прокручуємо лише контейнер коду, а не всю сторінку
  useEffect(() => {
    const box = boxRef.current;
    const el = activeRef.current;
    if (box && el) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  }, [activeLine, file.path]);

  return (
    <div className="code-window">
      <div className="code-bar">
        <span className="dots"><i /><i /><i /></span>
        <span className="code-file">{file.path}</span>
        <span className="code-meta">{lines.length} рядків</span>
      </div>
      <div className="code" ref={boxRef} aria-label={`Код файлу ${file.path}`}>
        {lines.map((text, idx) => {
          const n = idx + 1;
          const sev = worst.get(n);
          const cls = ["code-line", sev ? `code-sev-${sev}` : "", n === activeLine ? "code-active" : ""].join(" ");
          return (
            <div key={n} className={cls} ref={n === activeLine ? activeRef : null}>
              <span className="code-num">{n}</span>
              <code>{text ? highlight(text) : " "}</code>
            </div>
          );
        })}
      </div>
    </div>
  );
}
