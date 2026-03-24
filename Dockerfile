FROM node:24-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/src ./src
COPY frontend/index.html ./

RUN npm install
RUN npm run build

FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend

WORKDIR /app

COPY pyproject.toml README.md ./
COPY backend ./backend
COPY frontend ./frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN pip install --no-cache-dir .

RUN useradd --create-home appuser
USER appuser

EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host ${HOST:-0.0.0.0} --port ${PORT:-8080} --workers ${UVICORN_WORKERS:-2}"]
