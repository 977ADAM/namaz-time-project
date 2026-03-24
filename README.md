# Namaz Time

Production-ready веб-сервис для отображения времен намаза по выбранному городу или текущему местоположению пользователя.

## Что реализовано

- главная страница `/` с временами намаза на сегодня
- автоматическое определение города через браузерную геолокацию
- ручной поиск города с debounce и подсказками
- определение текущего и следующего намаза
- таймер обратного отсчёта до следующего обязательного намаза
- григорианская и исламская даты
- страница месячного расписания `/monthly`
- страница настроек `/settings`
- страница `/about` с дисклеймером и privacy-информацией
- выбор метода расчёта
- выбор светлой и тёмной темы
- формат времени `12h` и `24h`
- сохранение настроек в `localStorage`
- адаптивный интерфейс для mobile/tablet/desktop
- унифицированные API-ошибки
- in-memory cache для daily/monthly/timezone lookup

## Архитектура

Проект состоит из двух частей:

- `backend/` — FastAPI-приложение, которое выступает единой точкой доступа к внешним провайдерам
- `frontend/` — статический SPA-интерфейс на vanilla JavaScript и CSS, отдаваемый самим backend

Backend отвечает за:

- валидацию входных параметров
- нормализацию данных внешних сервисов
- единый API-контракт для frontend
- унификацию ошибок
- кэширование популярных запросов
- сокрытие внешних интеграций от клиента

## Маршруты UI

- `/` — сегодня: следующий намаз, таймер, дневное расписание
- `/monthly` — месячное расписание с переключением месяцев
- `/settings` — тема, формат времени, метод расчёта, школа для Асра
- `/about` — описание проекта, дисклеймер, privacy-информация

## API

### Основные endpoints

- `GET /api/v1/prayer-times/today`
- `GET /api/v1/prayer-times/monthly`
- `GET /api/v1/cities/search`
- `GET /api/v1/location/reverse`
- `GET /api/v1/config/methods`

### Совместимость со старыми endpoints

- `GET /v1/prayer-times`
- `GET /v1/prayer-calendar`
- `GET /v1/locations/search`
- `GET /v1/locations/reverse`

### Пример: today

```bash
curl "http://127.0.0.1:8080/api/v1/prayer-times/today?lat=55.7558&lng=37.6173&date=2026-03-24&method=2&school=0"
```

### Пример: monthly

```bash
curl "http://127.0.0.1:8080/api/v1/prayer-times/monthly?lat=55.7558&lng=37.6173&year=2026&month=3&method=2&school=0"
```

### Пример: city search

```bash
curl "http://127.0.0.1:8080/api/v1/cities/search?q=Tashkent&limit=5"
```

### Формат ошибок

```json
{
  "error": {
    "code": "UPSTREAM_BAD_RESPONSE",
    "message": "Не удалось получить данные от внешнего сервиса",
    "details": null
  }
}
```

## Источники данных

### Времена намаза

- Провайдер: `Aladhan API`
- Использование в проекте:
  - daily timings
  - monthly calendar
  - определение timezone по координатам через `meta.timezone`
- Базовый URL:
  - `https://api.aladhan.com/v1/timings`
  - `https://api.aladhan.com/v1/calendar`
- Поддерживаемые методы расчёта в первой версии:
  - Muslim World League
  - Umm al-Qura University, Makkah
  - Egyptian General Authority of Survey
  - University of Islamic Sciences, Karachi
  - ISNA
  - Tehran
  - Jafari

Важно: у внешнего источника нет SLA, а расписание конкретной мечети может отличаться от астрономического расчёта.

### Геокодинг

- Провайдер: `OpenStreetMap Nominatim`
- Использование в проекте:
  - поиск города
  - reverse geocoding по координатам

Важно: timezone для выбранной локации не вычисляется на frontend “на глаз”, а нормализуется на backend через данные prayer provider.

## Ограничения первой версии

- настройки хранятся только локально в браузере
- нет авторизации и синхронизации между устройствами
- нет push-уведомлений и PWA
- нет избранных городов
- нет ручных minute-offset корректировок для отдельных намазов
- нет отдельной джума-логики
- высокие широты зависят от возможностей внешнего prayer provider

## Локальный запуск

```bash
source venv/bin/activate
cp .env.example .env
export PYTHONPATH=backend
uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

После запуска:

- UI: `http://127.0.0.1:8080/`
- Monthly: `http://127.0.0.1:8080/monthly`
- Settings: `http://127.0.0.1:8080/settings`
- About: `http://127.0.0.1:8080/about`
- Swagger: `http://127.0.0.1:8080/docs`

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Остановка:

```bash
docker compose down
```

## Переменные окружения

См. `.env.example`:

- `APP_NAME`
- `APP_VERSION`
- `APP_ENV`
- `APP_DEBUG`
- `LOG_LEVEL`
- `PRAYER_API_BASE_URL`
- `PRAYER_API_TIMEOUT_SECONDS`
- `CACHE_TTL_SECONDS`
- `CORS_ALLOW_ORIGINS`
- `HOST`
- `PORT`
- `UVICORN_WORKERS`

## Тесты

```bash
PYTHONPATH=backend ./venv/bin/python -m unittest discover -s tests -v
```

## Что стоит добавить во вторую фазу

- Redis вместо in-memory cache
- rate limiting публичных endpoints
- frontend error tracking
- E2E tests
- многоязычность beyond `ru`
- PWA и push-уведомления
