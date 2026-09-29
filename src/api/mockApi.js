// Мок REST API. Замінює серверну частину (FastAPI): дані зберігаються в localStorage,
// кожен виклик асинхронний і має штучну затримку, як реальний мережевий запит.
// Коли з’явиться бекенд, достатньо замінити реалізацію цих функцій на fetch/axios.

import { DEFAULT_RULES, DEMO_USERS, SAMPLE_CODE, IMPROVED_CODE, PROJECT_MAIN, PROJECT_UTILS } from "./seed.js";
import { analyzeFiles } from "./analyzer.js";

const DB_KEY = "ca_mock_db_v1";
const SESSION_KEY = "ca_mock_session_v1";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms + Math.random() * 250));

function seedDb() {
  const rules = structuredClone(DEFAULT_RULES);
  const mk = (id, userId, title, sourceType, files, createdAt) => {
    const res = analyzeFiles(files, rules);
    return { id, userId, title, sourceType, status: res.status, durationMs: res.durationMs, createdAt, files: res.files };
  };
  const analyses = [
    mk(1, 1, "lab2_solution.py (v1)", "file", [{ path: "lab2_solution.py", content: SAMPLE_CODE }], "2026-10-01T10:15:00"),
    mk(2, 2, "student_project.zip", "archive",
      [{ path: "main.py", content: PROJECT_MAIN }, { path: "utils.py", content: PROJECT_UTILS }], "2026-10-02T12:40:00"),
    mk(3, 1, "Фрагмент коду", "snippet", [{ path: "snippet.py", content: "def broken(:\n    pass\n" }], "2026-10-03T09:05:00"),
    mk(4, 1, "lab2_solution.py (v2)", "file", [{ path: "lab2_solution.py", content: IMPROVED_CODE }], "2026-10-05T18:20:00"),
  ];
  return { users: structuredClone(DEMO_USERS), rules, analyses, nextAnalysisId: 5, nextUserId: 4 };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* пошкоджені дані – створюємо заново */ }
  const db = seedDb();
  saveDb(db);
  return db;
}

function saveDb(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    throw new ApiError(507, "Недостатньо місця для збереження даних у браузері");
  }
}

function currentUser(db) {
  const id = Number(localStorage.getItem(SESSION_KEY));
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new ApiError(401, "Потрібна автентифікація");
  return user;
}

const publicUser = ({ password, ...u }) => u;

// ---------------------------------------------------------------- автентифікація
export const authApi = {
  // POST /api/auth/login
  async login({ email, password }) {
    await delay();
    const db = loadDb();
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.password !== password) throw new ApiError(401, "Невірний email або пароль");
    localStorage.setItem(SESSION_KEY, String(user.id));
    return publicUser(user);
  },
  // POST /api/auth/register
  async register({ email, password }) {
    await delay();
    const db = loadDb();
    if (db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      throw new ApiError(409, "Користувач із таким email уже існує");
    }
    const user = { id: db.nextUserId++, email: email.trim(), password, role: "user", name: email.split("@")[0] };
    db.users.push(user);
    saveDb(db);
    localStorage.setItem(SESSION_KEY, String(user.id));
    return publicUser(user);
  },
  // GET /api/auth/me
  async me() {
    await delay(120);
    try {
      return publicUser(currentUser(loadDb()));
    } catch {
      return null;
    }
  },
  logout() {
    localStorage.removeItem(SESSION_KEY);
  },
};

// ---------------------------------------------------------------- аналізи
const summary = (a, db) => ({
  id: a.id,
  title: a.title,
  sourceType: a.sourceType,
  status: a.status,
  durationMs: a.durationMs,
  createdAt: a.createdAt,
  filesCount: a.files.length,
  issuesCount: a.files.reduce((s, f) => s + f.issues.length, 0),
  maxComplexity: a.files.reduce((m, f) => Math.max(m, f.maxComplexity), 0),
  owner: db.users.find((u) => u.id === a.userId)?.email ?? "—",
});

function visible(db, user) {
  // студент бачить лише власні аналізи; викладач, керівник та адміністратор – усі
  return db.analyses.filter((a) => user.role === "user" ? a.userId === user.id : true);
}

export const analysesApi = {
  // GET /api/analyses
  async list() {
    await delay();
    const db = loadDb();
    const user = currentUser(db);
    return visible(db, user).map((a) => summary(a, db)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  // GET /api/analyses/{id}
  async get(id) {
    await delay();
    const db = loadDb();
    const user = currentUser(db);
    const a = visible(db, user).find((x) => x.id === Number(id));
    if (!a) throw new ApiError(404, "Аналіз не знайдено");
    return { ...a, owner: db.users.find((u) => u.id === a.userId)?.email ?? "—" };
  },
  // POST /api/analyses
  async create({ title, sourceType, files }) {
    await delay(900);
    const db = loadDb();
    const user = currentUser(db);
    if (!files || files.length === 0) throw new ApiError(400, "Немає коду для аналізу");
    const total = files.reduce((s, f) => s + f.content.length, 0);
    if (total > 1_000_000) throw new ApiError(413, "Розмір коду перевищує 1 МБ");
    const res = analyzeFiles(files, db.rules);
    const analysis = {
      id: db.nextAnalysisId++, userId: user.id, title: title || "Без назви", sourceType,
      status: res.status, durationMs: res.durationMs, createdAt: new Date().toISOString(), files: res.files,
    };
    db.analyses.push(analysis);
    saveDb(db);
    return analysis;
  },
  // DELETE /api/analyses/{id}
  async remove(id) {
    await delay(300);
    const db = loadDb();
    const user = currentUser(db);
    const a = visible(db, user).find((x) => x.id === Number(id));
    if (!a) throw new ApiError(404, "Аналіз не знайдено");
    db.analyses = db.analyses.filter((x) => x.id !== a.id);
    saveDb(db);
  },
};

// ---------------------------------------------------------------- правила
export const rulesApi = {
  // GET /api/rules
  async list() {
    await delay(250);
    const db = loadDb();
    currentUser(db);
    return db.rules;
  },
  // PUT /api/rules/{id}  (лише адміністратор)
  async update(id, patch) {
    await delay(400);
    const db = loadDb();
    const user = currentUser(db);
    if (user.role !== "admin") throw new ApiError(403, "Змінювати правила може лише адміністратор");
    const rule = db.rules.find((r) => r.id === id);
    if (!rule) throw new ApiError(404, "Правило не знайдено");
    if (patch.threshold !== undefined && patch.threshold !== null) {
      if (!Number.isInteger(patch.threshold) || patch.threshold < 1 || patch.threshold > 500) {
        throw new ApiError(422, "Поріг має бути цілим числом від 1 до 500");
      }
    }
    Object.assign(rule, patch);
    saveDb(db);
    return rule;
  },
  // POST /api/rules/reset
  async reset() {
    await delay(300);
    const db = loadDb();
    if (currentUser(db).role !== "admin") throw new ApiError(403, "Недостатньо прав");
    db.rules = structuredClone(DEFAULT_RULES);
    saveDb(db);
    return db.rules;
  },
};

// Повне скидання демо-даних
export function resetDemoData() {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(SESSION_KEY);
}
