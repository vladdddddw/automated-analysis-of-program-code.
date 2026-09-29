import { useEffect, useMemo, useRef } from "react";
import { SEVERITIES } from "../../api/seed.js";

// Перегляд коду з підсвіченням рядків із зауваженнями; активний рядок прокручується в зону видимості.
export default function CodeViewer({ file, activeLine }) {
  const activeRef = useRef(null);
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

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLine, file.path]);

  return (
    <pre className="code" aria-label={`Код файлу ${file.path}`}>
      {lines.map((text, idx) => {
        const n = idx + 1;
        const sev = worst.get(n);
        const cls = ["code-line", sev ? `code-sev-${sev}` : "", n === activeLine ? "code-active" : ""].join(" ");
        return (
          <div key={n} className={cls} ref={n === activeLine ? activeRef : null}>
            <span className="code-num">{n}</span>
            <code>{text || " "}</code>
          </div>
        );
      })}
    </pre>
  );
}
