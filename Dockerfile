# ---------- 1. збірка фронтенду (React + Vite) ----------
FROM node:22-alpine AS frontend
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# режим «справжній бекенд»: запити йдуть на той самий домен (/api/...)
ENV VITE_BACKEND=real
RUN npm run build

# ---------- 2. серверна частина (FastAPI) + готовий фронтенд ----------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=frontend /web/dist ./static
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser
EXPOSE 8000
# Render передає порт у змінній PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
