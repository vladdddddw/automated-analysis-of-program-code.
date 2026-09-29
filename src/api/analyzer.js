// Мок-аналізатор Python-коду. Виконується у браузері за спрощеними правилами
// (у повній системі аналіз виконує серверна частина на Python + ast).

const KEYWORDS_RE = /\b(if|elif|for|while|except|and|or)\b/g;

function stripStringsAndComments(line) {
  return line.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""').replace(/#.*$/, "");
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function checkSyntax(lines) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (let i = 0; i < lines.length; i++) {
    const clean = stripStringsAndComments(lines[i]);
    for (const ch of clean) {
      if ("([{".includes(ch)) stack.push({ ch, line: i + 1 });
      else if (")]}".includes(ch)) {
        const top = stack.pop();
        if (!top || top.ch !== pairs[ch]) return `невідповідна дужка «${ch}» (рядок ${i + 1})`;
      }
    }
    const t = clean.trim();
    if (/^(def|class|if|elif|else|for|while|try|except|finally|with)\b/.test(t) && !t.endsWith(":") && !t.includes(":") &&
        !/[(\[{,\\]$/.test(t) && stack.length === 0) {
      return `очікується «:» наприкінці рядка ${i + 1}`;
    }
  }
  if (stack.length) return `незакрита дужка «${stack[0].ch}» (рядок ${stack[0].line})`;
  return null;
}

function findFunctions(lines) {
  const funcs = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)def\s+(\w+)\s*\((.*)\)\s*(?:->\s*[^:]+)?:\s*$/);
    if (!m) continue;
    const baseIndent = m[1].length;
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === "") continue;
      if (indentOf(lines[j]) <= baseIndent) break;
      end = j;
    }
    const params = m[3].split(",").map((p) => p.trim()).filter((p) => p && p !== "self" && p !== "cls");
    let complexity = 1;
    let nesting = 0;
    for (let j = i + 1; j <= end; j++) {
      const clean = stripStringsAndComments(lines[j]);
      if (clean.trim() === "") continue;
      complexity += (clean.match(KEYWORDS_RE) || []).length;
      const levels = Math.floor((indentOf(lines[j]) - baseIndent) / 4);
      nesting = Math.max(nesting, levels - 1);
    }
    let k = i + 1;
    while (k <= end && lines[k].trim() === "") k++;
    const hasDoc = k <= end && /^\s*(?:[rRuUbB]{0,2})("""|''')/.test(lines[k]);
    funcs.push({
      name: m[2], startLine: i + 1, endLine: end + 1, complexity, nestingDepth: Math.max(nesting, 0),
      params: params.length, paramsText: m[3], hasDoc,
    });
  }
  return funcs;
}

function analyzeFile(file, cfg) {
  const lines = file.content.replace(/\r\n/g, "\n").split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const loc = lines.length;
  const sloc = lines.filter((l) => l.trim() !== "" && !l.trim().startsWith("#")).length;
  const result = { path: file.path, content: file.content, loc, sloc, maxComplexity: 0, maxNesting: 0,
    syntaxError: null, functions: [], issues: [] };

  const syntaxError = checkSyntax(lines);
  if (syntaxError) {
    result.syntaxError = `Синтаксична помилка: ${syntaxError}`;
    return result;
  }

  let issueId = 1;
  const add = (ruleId, line, message) => {
    const rule = cfg[ruleId];
    if (!rule || !rule.enabled) return;
    result.issues.push({ id: issueId++, ruleId, severity: rule.severity, line, message });
  };
  const th = (id, fallback) => (cfg[id] && cfg[id].threshold) || fallback;

  const funcs = findFunctions(lines);
  result.functions = funcs.map(({ hasDoc, paramsText, ...f }) => f);
  result.maxComplexity = funcs.reduce((m, f) => Math.max(m, f.complexity), 0);
  result.maxNesting = funcs.reduce((m, f) => Math.max(m, f.nestingDepth), 0);

  // AC001: невикористані імпорти
  const code = lines.map(stripStringsAndComments);
  lines.forEach((line, i) => {
    const m1 = line.match(/^\s*import\s+(.+)$/);
    const m2 = line.match(/^\s*from\s+[\w.]+\s+import\s+(.+)$/);
    const spec = m1 ? m1[1] : m2 ? m2[1] : null;
    if (!spec || spec.trim() === "*") return;
    spec.split(",").forEach((part) => {
      const seg = part.trim().split(/\s+as\s+/);
      const name = (seg[1] || seg[0]).split(".")[0].trim();
      if (!name) return;
      const re = new RegExp(`\\b${name}\\b`);
      const used = code.some((c, j) => j !== i && re.test(c));
      if (!used) add("AC001", i + 1, `Імпорт ${name} не використовується`);
    });
  });

  lines.forEach((line, i) => {
    const clean = stripStringsAndComments(line);
    // AC002: порожній except
    if (/^\s*except\s*:/.test(clean)) add("AC002", i + 1, "Порожній блок except без типу винятку");
    // AC004: eval / exec
    const ev = clean.match(/(?<![.\w])(eval|exec)\s*\(/);
    if (ev) add("AC004", i + 1, `Використано ${ev[1]}() з довільним рядком`);
    // AC010: секрети
    if (/(password|passwd|secret|token|api_key)\w*\s*=\s*["'][^"']{3,}["']/i.test(line)) {
      add("AC010", i + 1, "Секрет записано безпосередньо в коді");
    }
  });

  funcs.forEach((f) => {
    if (/=\s*(\[\]|\{\}|set\(\))/.test(f.paramsText)) add("AC003", f.startLine, `Змінне значення за замовчуванням у функції ${f.name}`);
    const lengthTh = th("AC005", 50);
    const len = f.endLine - f.startLine + 1;
    if (len > lengthTh) add("AC005", f.startLine, `Функція ${f.name} має ${len} рядків (поріг ${lengthTh})`);
    const cxTh = th("AC006", 10);
    if (f.complexity > cxTh) add("AC006", f.startLine, `Цикломатична складність ${f.complexity} перевищує поріг ${cxTh}`);
    const nestTh = th("AC007", 4);
    if (f.nestingDepth > nestTh) add("AC007", f.startLine, `Глибина вкладеності ${f.nestingDepth} перевищує поріг ${nestTh}`);
    const paramTh = th("AC008", 5);
    if (f.params > paramTh) add("AC008", f.startLine, `Функція ${f.name} має ${f.params} параметрів (поріг ${paramTh})`);
    if (!f.hasDoc && !f.name.startsWith("_")) add("AC009", f.startLine, `Функція ${f.name} без docstring`);
  });

  result.issues.sort((a, b) => a.line - b.line);
  result.issues.forEach((it, idx) => (it.id = idx + 1));
  return result;
}

export function analyzeFiles(files, rules) {
  const cfg = Object.fromEntries(rules.map((r) => [r.id, r]));
  const started = performance.now();
  const analyzed = files.map((f) => analyzeFile(f, cfg));
  const durationMs = Math.max(1, Math.round(performance.now() - started));
  const allFailed = analyzed.length > 0 && analyzed.every((f) => f.syntaxError);
  return { files: analyzed, durationMs, status: allFailed ? "failed" : "done" };
}
