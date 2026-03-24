# Namaz Time MVP

Минимальный продукт для получения времени намаза по координатам и дате.

Что входит в MVP:
- FastAPI backend с endpoint `GET /v1/prayer-times`
- простой frontend, доступный на `/`
- health-check `GET /health`
- локальные тесты без реальных сетевых вызовов

## Быстрый запуск

```bash
source venv/bin/activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 8080 --reload
```

После запуска:
- UI: `http://127.0.0.1:8080/`
- Swagger: `http://127.0.0.1:8080/docs`

## Пример API-запроса

```bash
curl "http://127.0.0.1:8080/v1/prayer-times?latitude=55.7558&longitude=37.6173&date=2026-03-24&method=2&school=0"
```

## Тесты

```bash
PYTHONPATH=backend ./venv/bin/python -m unittest discover -s tests -v
```
