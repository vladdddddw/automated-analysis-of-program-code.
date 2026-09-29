// Початкові (мокові) дані. Відповідають структурі БД із лабораторної роботи № 5.

export const SEVERITIES = {
  info: { label: "Інформація", rank: 1 },
  low: { label: "Низька", rank: 2 },
  medium: { label: "Середня", rank: 3 },
  high: { label: "Висока", rank: 4 },
  critical: { label: "Критична", rank: 5 },
};

export const CATEGORIES = {
  security: "Безпека",
  reliability: "Надійність",
  maintainability: "Супроводжуваність",
  style: "Стиль",
};

export const DEFAULT_RULES = [
  { id: "AC001", name: "Невикористаний імпорт", category: "style", severity: "low", threshold: null, enabled: true,
    description: "Імпортований модуль не використовується в коді", recommendation: "Видаліть невикористаний імпорт." },
  { id: "AC002", name: "Порожній блок except", category: "reliability", severity: "medium", threshold: null, enabled: true,
    description: "Блок except без типу винятку", recommendation: "Вкажіть конкретний тип винятку та обробіть його." },
  { id: "AC003", name: "Змінний аргумент за замовчуванням", category: "reliability", severity: "medium", threshold: null, enabled: true,
    description: "Список або словник як значення параметра за замовчуванням",
    recommendation: "Використовуйте None та створюйте об’єкт усередині функції." },
  { id: "AC004", name: "Використання eval/exec", category: "security", severity: "critical", threshold: null, enabled: true,
    description: "Виклик eval() або exec() з довільним рядком",
    recommendation: "Замініть eval/exec на безпечну альтернативу (ast.literal_eval, словник функцій)." },
  { id: "AC005", name: "Надто довга функція", category: "maintainability", severity: "low", threshold: 50, enabled: true,
    description: "Кількість рядків функції перевищує поріг", recommendation: "Розбийте функцію на менші." },
  { id: "AC006", name: "Висока цикломатична складність", category: "maintainability", severity: "medium", threshold: 10, enabled: true,
    description: "Цикломатична складність функції перевищує поріг",
    recommendation: "Спростіть розгалуження, винесіть частину логіки в окремі функції." },
  { id: "AC007", name: "Надмірна вкладеність", category: "maintainability", severity: "medium", threshold: 4, enabled: true,
    description: "Глибина вкладеності блоків перевищує поріг",
    recommendation: "Використовуйте ранні повернення та винесення вкладених блоків." },
  { id: "AC008", name: "Забагато параметрів", category: "maintainability", severity: "low", threshold: 5, enabled: true,
    description: "Кількість параметрів функції перевищує поріг",
    recommendation: "Згрупуйте параметри в об’єкт або структуру даних." },
  { id: "AC009", name: "Відсутній docstring", category: "style", severity: "info", threshold: null, enabled: true,
    description: "Публічна функція без документаційного рядка", recommendation: "Додайте docstring з описом призначення." },
  { id: "AC010", name: "Жорстко закодований секрет", category: "security", severity: "high", threshold: null, enabled: true,
    description: "Пароль або токен записано безпосередньо в коді",
    recommendation: "Зберігайте секрети в змінних середовища або сховищі секретів." },
];

export const DEMO_USERS = [
  { id: 1, email: "student@example.com", password: "student123", role: "user", name: "Студент" },
  { id: 2, email: "teacher@example.com", password: "teacher123", role: "teacher", name: "Викладач" },
  { id: 3, email: "admin@example.com", password: "admin123", role: "admin", name: "Адміністратор" },
];

export const ROLE_LABELS = { user: "Розробник", teacher: "Викладач", manager: "Керівник", admin: "Адміністратор" };

export const SAMPLE_CODE = `import os
import sys
import json


def load_config(path, defaults={}):
    """Завантажує конфігурацію з файлу."""
    try:
        with open(path) as f:
            return json.load(f)
    except:
        return defaults


def process_data(items, mode, limit, offset, flag, verbose):
    result = []
    for item in items:
        if mode == "a":
            if item > limit:
                if flag:
                    for k in range(offset):
                        if k % 2 == 0 and verbose:
                            result.append(item * k)
                elif item < 0:
                    result.append(0)
            elif item == limit:
                result.append(limit)
        elif mode == "b":
            while item > 0:
                item -= 1
                if item % 3 == 0 or item % 5 == 0:
                    result.append(item)
        else:
            result.append(eval("item + 1"))
    return result


PASSWORD = "admin12345"


def main():
    cfg = load_config(sys.argv[1])
    print(process_data(cfg.get("items", []), "a", 10, 5, True, False))


if __name__ == "__main__":
    main()
`;

export const IMPROVED_CODE = `import sys
import json


def load_config(path, defaults=None):
    """Завантажує конфігурацію з файлу."""
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return defaults or {}


def transform(item, mode, limit):
    """Перетворює один елемент залежно від режиму."""
    if mode == "a" and item > limit:
        return item * 2
    if mode == "b":
        return item - 1
    return item + 1


def process_data(items, mode, limit):
    """Обробляє список елементів."""
    return [transform(item, mode, limit) for item in items]


def main():
    """Точка входу."""
    cfg = load_config(sys.argv[1])
    print(process_data(cfg.get("items", []), "a", 10))


if __name__ == "__main__":
    main()
`;

export const PROJECT_MAIN = `import utils


def run(data):
    """Запускає обробку."""
    try:
        value = eval(data)
    except:
        value = None
    return utils.connect(value)
`;

export const PROJECT_UTILS = `password = "qwerty2026"


def connect(value, cache=[]):
    cache.append(value)
    return cache
`;
