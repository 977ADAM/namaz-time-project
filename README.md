# Namaz Time API

Адаптивный сайт и API для просмотра актуального времени намаза по городу или текущему местоположению.

Что уже готово:
- FastAPI backend с endpoint `GET /v1/prayer-times`
- месячный календарь через `GET /v1/prayer-calendar`
- поиск города и reverse geocoding через `GET /v1/locations/search` и `GET /v1/locations/reverse`
- frontend, доступный на `/`, с выбором города, определением геолокации, следующим намазом и таблицей на месяц
- `health`, `ready` и `meta` endpoints для эксплуатации
- конфигурация через переменные окружения
- in-memory TTL cache для снижения нагрузки на внешний prayer API
- Docker и `docker-compose` для развёртывания
- тесты на API и сервисный слой

## Локальный запуск

```bash
source venv/bin/activate
cp .env.example .env
export PYTHONPATH=backend
uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

После запуска:
- UI: `http://127.0.0.1:8080/`
- Swagger: `http://127.0.0.1:8080/docs`
- Health: `http://127.0.0.1:8080/health`
- Ready: `http://127.0.0.1:8080/ready`
- Meta: `http://127.0.0.1:8080/v1/meta`

## Production-lite запуск через Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Остановка:

```bash
docker compose down
```

## Переменные окружения

Основные настройки лежат в `.env.example`:
- `APP_ENV` окружение (`development`, `production`)
- `LOG_LEVEL` уровень логирования
- `PRAYER_API_TIMEOUT_SECONDS` timeout внешнего API
- `CACHE_TTL_SECONDS` TTL кэша в секундах
- `CORS_ALLOW_ORIGINS` список origin через запятую
- `UVICORN_WORKERS` число воркеров для контейнера

## Пример API-запроса

```bash
curl "http://127.0.0.1:8080/v1/prayer-times?latitude=55.7558&longitude=37.6173&date=2026-03-24&method=2&school=0"
```

```bash
curl "http://127.0.0.1:8080/v1/prayer-calendar?latitude=55.7558&longitude=37.6173&year=2026&month=3&method=2&school=0"
```

```bash
curl "http://127.0.0.1:8080/v1/locations/search?q=Moscow"
```

## Тесты

```bash
PYTHONPATH=backend ./venv/bin/python -m unittest discover -s tests -v
```
