// Справжній HTTP-клієнт: ті самі функції, що й у mockApi.js, але запити йдуть до FastAPI-бекенду.
// Авторизація – заголовок Authorization: Bearer <JWT>; токен зберігається в localStorage.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "ca_token";

const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};

// Один спільний виклик fetch: додає токен, розбирає JSON і перетворює помилки сервера на ApiError.
async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form; // multipart: браузер сам виставить Content-Type
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Сервер недоступний. Якщо він щойно запускається, зачекайте хвилину й повторіть спробу");
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* тіло не JSON */ }
  if (!res.ok) {
    if (res.status === 401 && token && path !== "/api/auth/login") setToken(null); // токен прострочений
    throw new ApiError(res.status, data?.message || `Помилка запиту (${res.status})`);
  }
  return data;
}

// ---------------------------------------------------------------- автентифікація
export const authApi = {
  async login({ email, password }) {
    const { token, user } = await request("/api/auth/login", { method: "POST", body: { email, password } });
    setToken(token);
    return user;
  },
  async register({ email, password }) {
    const { token, user } = await request("/api/auth/register", { method: "POST", body: { email, password } });
    setToken(token);
    return user;
  },
  async me() {
    if (!getToken()) return null;
    try {
      return await request("/api/auth/me");
    } catch (e) {
      if (e.status === 0) throw e; // сервер недоступний – не «розлогінюємо»
      return null;
    }
  },
  logout() {
    setToken(null);
  },
};

// ---------------------------------------------------------------- аналізи
export const analysesApi = {
  list: () => request("/api/analyses"),
  stats: () => request("/api/stats"),
  get: (id) => request(`/api/analyses/${id}`),
  create: ({ title, sourceType, files }) => request("/api/analyses", { method: "POST", body: { title, sourceType, files } }),
  createFromArchive({ title, file }) {
    const form = new FormData();
    form.append("file", file);
    form.append("title", title || "");
    return request("/api/analyses/archive", { method: "POST", form });
  },
  remove: (id) => request(`/api/analyses/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------- правила
export const rulesApi = {
  list: () => request("/api/rules"),
  update: (id, patch) => request(`/api/rules/${id}`, { method: "PUT", body: patch }),
  reset: () => request("/api/rules/reset", { method: "POST" }),
};
