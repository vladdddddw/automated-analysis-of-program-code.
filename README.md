# CodeInspector – фронтенд

Клієнтська частина вебзастосунку **автоматизованого аналізу програмного коду** (лабораторна робота № 6-7).
Стек: React 18 + Vite + React Router.

> **Демо-режим.** Бекенд (Python + AST + FastAPI) ще не підключено, тому всі дані **мокові**:
> шар `src/api/mockApi.js` імітує REST API (затримки, помилки, ролі), дані зберігаються в `localStorage`,
> а аналіз коду виконує спрощений мок-аналізатор у браузері (`src/api/analyzer.js`).

**Демо:** https://vladdddddw.github.io/automated-analysis-of-program-code./

Демо-акаунти (кнопки на сторінці входу заповнюють форму автоматично):

| Роль | Email | Пароль |
|------|-------|--------|
| Розробник | student@example.com | student123 |
| Викладач | teacher@example.com | teacher123 |
| Адміністратор | admin@example.com | admin123 |

## Можливості

- вхід і реєстрація з валідацією форм;
- новий аналіз: вставка фрагмента або завантаження `.py`-файлів (drag & drop);
- звіт: метрики, графіки, таблиця зауважень (фільтри, пошук, сортування), перегляд коду з підсвічуванням, рекомендації, експорт JSON/HTML;
- історія аналізів: пошук, фільтри, пагінація, видалення, порівняння двох аналізів;
- правила перевірки: перегляд для всіх, редагування (перемикач, поріг) – лише для адміністратора;
- адаптивна верстка (Desktop + Mobile).

## Запуск

```bash
npm install
npm run dev        # режим розробки: http://localhost:5173
npm run build      # збірка у dist/
npm run preview    # перегляд збірки
```

Для GitHub Pages збірка виконується з підкаталогом:

```bash
VITE_BASE=/automated-analysis-of-program-code./ npm run build
```

## Структура

```
src/
├── api/            мок REST API, мок-аналізатор, початкові дані
├── context/        AuthContext, ToastContext (стан застосунку)
├── hooks/          useAsync (запити до API)
├── utils/          форматування, валідація
├── components/
│   ├── layout/     Header, Sidebar, Footer, Layout
│   ├── common/     Button, Card, Modal, FormField, Badge, ...
│   ├── report/     IssuesTable, CodeViewer, Charts, ExportButtons
│   └── rules/      RuleForm
├── pages/          Login/Register, Analyze, Report, History, Rules
└── styles/         global.css (Flexbox/Grid, media queries)
```

Перехід на реальний бекенд: замінити реалізацію функцій у `src/api/mockApi.js` на `fetch`-запити до FastAPI
(URL-адреси вже зазначені в коментарях, наприклад `POST /api/analyses`).
