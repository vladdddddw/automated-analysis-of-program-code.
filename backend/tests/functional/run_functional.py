"""Функціональне тестування (метод «чорної скриньки») працюючого сервісу CodeInspector.

Тест-кейси виконуються проти реально запущеного сервера: частина – через REST API (httpx),
частина – через інтерфейс у браузері Chrome (Playwright). Скрипт нічого не імпортує із застосунку,
тому перевіряється саме розгорнута система, а не її внутрішній код.

Запуск (сервер уже працює):
    set BASE_URL=http://localhost:8000
    python tests/functional/run_functional.py --json results.json --shots shots
Потрібні пакети: httpx, playwright (див. requirements-dev.txt); для UI – встановлений Google Chrome.
"""
import argparse
import io
import json
import os
import sys
import time
import zipfile
from pathlib import Path

import httpx

BASE = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")
SHOTS: Path | None = None
RESULTS: list[dict] = []

STUDENT = ("student@example.com", "student123")
ADMIN = ("admin@example.com", "admin123")
SAMPLE = "import os\n\ndef process(data, cache=[]):\n    result = eval(data)\n    return result\n"


# ---------------------------------------------------------------- допоміжне
def api() -> httpx.Client:
    return httpx.Client(base_url=BASE, timeout=30)


def login(c: httpx.Client, creds) -> dict:
    r = c.post("/api/auth/login", json={"email": creds[0], "password": creds[1]})
    r.raise_for_status()
    return {"Authorization": "Bearer " + r.json()["token"]}


def analyze(c, h, files, title="tc", source="snippet"):
    return c.post("/api/analyses", headers=h, json={"title": title, "sourceType": source, "files": files})


def make_zip(entries: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, text in entries.items():
            z.writestr(name, text)
    return buf.getvalue()


class Browser:
    """Окремий контекст браузера (чиста сесія) для кожного UI-тесту."""

    def __enter__(self):
        from playwright.sync_api import sync_playwright
        self._pw = sync_playwright().start()
        self.browser = self._pw.chromium.launch(channel="chrome", headless=True)
        self.ctx = self.browser.new_context(viewport={"width": 1360, "height": 860}, device_scale_factor=1.5, locale="uk-UA")
        self.page = self.ctx.new_page()
        return self

    def __exit__(self, *exc):
        self.browser.close()
        self._pw.stop()

    def goto(self, route):
        self.page.goto(f"{BASE}/#/{route}")
        self.page.wait_for_timeout(700)

    def login(self, creds=STUDENT):
        self.goto("login")
        self.page.fill("input[type=email]", creds[0])
        self.page.fill("input[type=password]", creds[1])
        self.page.click("button[type=submit]")
        self.page.wait_for_timeout(1200)

    def text(self):
        return self.page.inner_text("body")

    def shot(self, name):
        if SHOTS:
            SHOTS.mkdir(parents=True, exist_ok=True)
            self.page.screenshot(path=str(SHOTS / f"{name}.png"))


# ---------------------------------------------------------------- тест-кейси
CASES = []


def case(tc_id, title, kind, positive, expected):
    def deco(fn):
        CASES.append(dict(id=tc_id, title=title, kind=kind, positive=positive, expected=expected, fn=fn))
        return fn
    return deco


@case("TC-001", "Правильна авторизація", "UI", True, "Користувач потрапляє на панель керування")
def tc001():
    with Browser() as b:
        b.login()
        b.shot("tc001_dashboard")
        ok = b.page.url.endswith("#/dashboard") and "Вітаємо" in b.text()
        return ("Відкрито панель керування" if ok else f"URL: {b.page.url}"), ok


@case("TC-002", "Авторизація з неправильним паролем", "UI", False, "Повідомлення «Невірний email або пароль», вхід не виконано")
def tc002():
    with Browser() as b:
        b.login((STUDENT[0], "wrong-password"))
        b.shot("tc002_wrong_password")
        ok = "Невірний email або пароль" in b.text() and b.page.url.endswith("#/login")
        return ("Показано повідомлення про помилку, залишились на формі входу" if ok else "Повідомлення відсутнє"), ok


@case("TC-003", "Авторизація з порожніми полями", "UI", False, "Підказки «Введіть email» і «Введіть пароль», запит не надсилається")
def tc003():
    with Browser() as b:
        b.goto("login")
        b.page.click("button[type=submit]")
        b.page.wait_for_timeout(400)
        b.shot("tc003_empty_login")
        t = b.text()
        ok = "Введіть email" in t and "Введіть пароль" in t and b.page.url.endswith("#/login")
        return ("Показано обидві підказки" if ok else "Підказки відсутні"), ok


@case("TC-004", "Реєстрація нового користувача", "UI", True, "Обліковий запис створено, користувача автоматично авторизовано")
def tc004():
    email = f"tester{int(time.time())}@example.com"
    with Browser() as b:
        b.goto("register")
        ins = b.page.query_selector_all("input")
        ins[0].fill(email)
        ins[1].fill("Secret123")
        ins[2].fill("Secret123")
        b.page.click("button[type=submit]")
        b.page.wait_for_timeout(1500)
        b.shot("tc004_register")
        ok = b.page.url.endswith("#/dashboard")
        return (f"Створено {email}, відкрито панель" if ok else f"URL: {b.page.url}"), ok


@case("TC-005", "Реєстрація: паролі не збігаються", "UI", False, "Повідомлення «Паролі не збігаються», акаунт не створюється")
def tc005():
    with Browser() as b:
        b.goto("register")
        ins = b.page.query_selector_all("input")
        ins[0].fill("mismatch@example.com")
        ins[1].fill("Secret123")
        ins[2].fill("Secret124")
        b.page.click("button[type=submit]")
        b.page.wait_for_timeout(600)
        b.shot("tc005_mismatch")
        ok = "Паролі не збігаються" in b.text() and b.page.url.endswith("#/register")
        return ("Показано повідомлення, форма залишилась" if ok else "Повідомлення відсутнє"), ok


@case("TC-006", "Реєстрація з email, що вже існує", "API", False, "HTTP 409 і повідомлення «Користувач із таким email уже існує»")
def tc006():
    with api() as c:
        r = c.post("/api/auth/register", json={"email": STUDENT[0], "password": "Secret123"})
        ok = r.status_code == 409 and "уже існує" in r.text
        return f"HTTP {r.status_code}: {r.json().get('message')}", ok


@case("TC-007", "Аналіз фрагмента коду з проблемами", "UI", True, "Створено звіт: знайдено зауваження (в т. ч. критичне – eval)")
def tc007():
    with Browser() as b:
        b.login()
        b.goto("analyze")
        b.page.fill("textarea", SAMPLE)
        b.page.click("button:has-text('Аналізувати')")
        b.page.wait_for_timeout(2200)
        b.shot("tc007_report")
        t = b.text()
        ok = "#/report/" in b.page.url and "Критична" in t and "Зауваження" in t
        return ("Відкрито звіт із зауваженнями" if ok else f"URL: {b.page.url}"), ok


@case("TC-008", "Аналіз порожнього фрагмента", "UI", False, "Повідомлення «Введіть код або вставте приклад», аналіз не запускається")
def tc008():
    with Browser() as b:
        b.login()
        b.goto("analyze")
        b.page.click("button:has-text('Аналізувати')")
        b.page.wait_for_timeout(600)
        b.shot("tc008_empty_code")
        ok = "Введіть код або вставте приклад" in b.text() and b.page.url.endswith("#/analyze")
        return ("Показано повідомлення, аналіз не запущено" if ok else "Повідомлення відсутнє"), ok


@case("TC-009", "Аналіз коду із синтаксичною помилкою", "API", False, "Сервер не падає: аналіз зі статусом failed і повідомленням про рядок помилки")
def tc009():
    with api() as c:
        h = login(c, STUDENT)
        r = analyze(c, h, [{"path": "bad.py", "content": "def broken(:\n    pass\n"}])
        d = r.json()
        err = (d.get("files") or [{}])[0].get("syntaxError") or ""
        ok = r.status_code == 201 and d.get("status") == "failed" and "рядок" in err
        return f"HTTP {r.status_code}, status={d.get('status')}, {err}", ok


@case("TC-010", "Аналіз архіву .zip", "API", True, "HTTP 201, у звіті 2 файли")
def tc010():
    with api() as c:
        h = login(c, STUDENT)
        data = make_zip({"proj/a.py": "import os\n", "proj/b.py": "def f():\n    pass\n"})
        r = c.post("/api/analyses/archive", headers=h, files={"file": ("proj.zip", data, "application/zip")}, data={"title": "tc010"})
        ok = r.status_code == 201 and r.json().get("filesCount") == 2
        return f"HTTP {r.status_code}, файлів: {r.json().get('filesCount')}", ok


@case("TC-011", "Архів зі шляхом ../ (спроба виходу з каталогу)", "API", False, "HTTP 400; повідомлення вказує на небезпечні шляхи в архіві")
def tc011():
    with api() as c:
        h = login(c, STUDENT)
        data = make_zip({"../evil.py": "x = 1\n"})
        r = c.post("/api/analyses/archive", headers=h, files={"file": ("evil.zip", data, "application/zip")})
        msg = r.json().get("message", "")
        ok = r.status_code == 400 and "небезпечн" in msg.lower()
        return f"HTTP {r.status_code}: «{msg}»", ok


@case("TC-012", "Пошук в історії за назвою", "UI", True, "У списку лише аналізи, назва яких містить «tc010»")
def tc012():
    with Browser() as b:
        b.login()
        b.goto("history")
        b.page.fill("input[type=search]", "tc010")
        b.page.wait_for_timeout(600)
        b.shot("tc012_search")
        names = [e.get_attribute("aria-label").replace("Видалити ", "") for e in b.page.query_selector_all("button[aria-label^='Видалити ']")]
        ok = bool(names) and all("tc010" in n.lower() for n in names)
        return f"Знайдено записів: {len(names)}", ok


@case("TC-013", "Пошук неіснуючої назви", "UI", False, "Повідомлення «Аналізів не знайдено», список порожній")
def tc013():
    with Browser() as b:
        b.login()
        b.goto("history")
        b.page.fill("input[type=search]", "zzzqqq-немає")
        b.page.wait_for_timeout(600)
        b.shot("tc013_search_empty")
        ok = "Аналізів не знайдено" in b.text()
        return ("Показано «Аналізів не знайдено»" if ok else "Повідомлення відсутнє"), ok


@case("TC-014", "Експорт звіту у HTML", "API", True, "HTTP 200, text/html, таблиця зауважень у документі")
def tc014():
    with api() as c:
        h = login(c, STUDENT)
        aid = analyze(c, h, [{"path": "a.py", "content": SAMPLE}], title="export-check").json()["id"]
        r = c.get(f"/api/analyses/{aid}/export", params={"format": "html"}, headers=h)
        ok = r.status_code == 200 and "text/html" in r.headers["content-type"] and "<table" in r.text and "AC004" in r.text
        return f"HTTP {r.status_code}, {r.headers['content-type']}, {len(r.text)} байт", ok


@case("TC-015", "Зміна правила користувачем без прав адміністратора", "API", False, "HTTP 403, правило не змінено")
def tc015():
    with api() as c:
        h = login(c, STUDENT)
        r = c.put("/api/rules/AC005", headers=h, json={"enabled": True, "threshold": 30})
        return f"HTTP {r.status_code}: {r.json().get('message')}", r.status_code == 403


@case("TC-016", "Зміна порога правила адміністратором", "API", True, "HTTP 200, поріг правила AC005 дорівнює 30")
def tc016():
    with api() as c:
        h = login(c, ADMIN)
        r = c.put("/api/rules/AC005", headers=h, json={"enabled": True, "threshold": 30})
        ok = r.status_code == 200 and r.json().get("threshold") == 30
        res = f"HTTP {r.status_code}, threshold={r.json().get('threshold')}"
        c.post("/api/rules/reset", headers=h)  # повертаємо налаштування
        return res, ok


@case("TC-017", "Видалення аналізу", "API", True, "HTTP 204; повторний запит звіту повертає 404")
def tc017():
    with api() as c:
        h = login(c, STUDENT)
        aid = analyze(c, h, [{"path": "a.py", "content": "x = 1\n"}], title="to-delete").json()["id"]
        d = c.delete(f"/api/analyses/{aid}", headers=h)
        g = c.get(f"/api/analyses/{aid}", headers=h)
        return f"DELETE {d.status_code}, потім GET {g.status_code}", d.status_code == 204 and g.status_code == 404


@case("TC-018", "Вихід із системи", "UI", True, "Користувача перенаправлено на сторінку входу")
def tc018():
    with Browser() as b:
        b.login()
        b.page.click("button[aria-label='Вийти']")
        b.page.wait_for_timeout(900)
        b.shot("tc018_logout")
        ok = b.page.url.endswith("#/login")
        return ("Відкрито сторінку входу" if ok else f"URL: {b.page.url}"), ok


@case("TC-019", "Код із символом NUL (U+0000)", "API", False, "Запит відхилено з кодом 422 і зрозумілим повідомленням")
def tc019():
    with api() as c:
        h = login(c, STUDENT)
        r = analyze(c, h, [{"path": "nul.py", "content": "x = 1\u0000\n"}])
        return f"HTTP {r.status_code}: {r.json().get('message')}", r.status_code == 422


@case("TC-020", "Реєстрація з паролем із самих пробілів", "API", False, "HTTP 422: такий пароль не приймається")
def tc020():
    with api() as c:
        r = c.post("/api/auth/register", json={"email": f"spaces{int(time.time())}@example.com", "password": "        "})
        return f"HTTP {r.status_code}", r.status_code == 422


@case("TC-021", "Файл не з розширенням .py", "API", False, "HTTP 422: приймаються лише файли .py")
def tc021():
    with api() as c:
        h = login(c, STUDENT)
        r = analyze(c, h, [{"path": "notes.txt", "content": "x = 1\n"}], source="file")
        return f"HTTP {r.status_code}", r.status_code == 422


# ---------------------------------------------------------------- запуск
def main():
    global SHOTS
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help="куди записати результати")
    ap.add_argument("--shots", help="папка для скріншотів UI-тестів")
    ap.add_argument("--only", help="виконати лише перелічені тест-кейси (через кому)")
    args = ap.parse_args()
    SHOTS = Path(args.shots) if args.shots else None
    only = set(args.only.split(",")) if args.only else None
    print(f"Сервіс: {BASE}")
    for tc in CASES:
        if only and tc["id"] not in only:
            continue
        try:
            actual, ok = tc["fn"]()
        except Exception as exc:  # збій самого тесту – теж FAIL
            actual, ok = f"Виняток: {exc!r}"[:200], False
        RESULTS.append(dict(id=tc["id"], title=tc["title"], kind=tc["kind"], positive=tc["positive"],
                            expected=tc["expected"], actual=actual, status="PASS" if ok else "FAIL"))
        print(f"{tc['id']}  {'PASS' if ok else 'FAIL'}  [{tc['kind']:3s}] {tc['title']}  ->  {actual}")
    passed = sum(r["status"] == "PASS" for r in RESULTS)
    print(f"\nПідсумок: {passed} з {len(RESULTS)} тест-кейсів пройдено")
    if args.json:
        Path(args.json).write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2), encoding="utf-8")
    sys.exit(0 if passed == len(RESULTS) else 1)


if __name__ == "__main__":
    main()
