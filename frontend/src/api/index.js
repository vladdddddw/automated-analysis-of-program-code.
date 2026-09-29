// Єдина точка входу до API. Режим обирається під час збірки змінною VITE_BACKEND:
//   VITE_BACKEND=real  – справжній бекенд (FastAPI); адреса в VITE_API_URL (порожня = той самий домен)
//   інакше             – мокове API у браузері (демо на GitHub Pages)
import * as mock from "./mockApi.js";
import * as http from "./httpApi.js";

export const USE_BACKEND = import.meta.env.VITE_BACKEND === "real";
const impl = USE_BACKEND ? http : mock;

export const authApi = impl.authApi;
export const analysesApi = impl.analysesApi;
export const rulesApi = impl.rulesApi;
export const ApiError = impl.ApiError;
