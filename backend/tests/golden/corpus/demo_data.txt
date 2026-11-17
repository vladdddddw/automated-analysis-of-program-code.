"""Довідникові та демонстраційні дані."""

SEVERITIES = [(1, "info", 1), (2, "low", 2), (3, "medium", 3), (4, "high", 4), (5, "critical", 5)]
ROLES = ["user", "teacher", "manager", "admin"]

# id, назва, опис, категорія, серйозність, поріг, рекомендація
RULES = [
    ("AC001", "Невикористаний імпорт", "Імпортований модуль не використовується в коді", "style", "low", None,
     "Видаліть невикористаний імпорт."),
    ("AC002", "Порожній блок except", "Блок except без типу винятку або лише з pass", "reliability", "medium", None,
     "Вкажіть конкретний тип винятку та обробіть його."),
    ("AC003", "Змінний аргумент за замовчуванням", "Список або словник як значення параметра за замовчуванням",
     "reliability", "medium", None, "Використовуйте None та створюйте об’єкт усередині функції."),
    ("AC004", "Використання eval/exec", "Виклик eval() або exec() з довільним рядком", "security", "critical", None,
     "Замініть eval/exec на безпечну альтернативу (ast.literal_eval, словник функцій)."),
    ("AC005", "Надто довга функція", "Кількість рядків функції перевищує поріг", "maintainability", "low", 50,
     "Розбийте функцію на менші."),
    ("AC006", "Висока цикломатична складність", "Цикломатична складність функції перевищує поріг", "maintainability",
     "medium", 10, "Спростіть розгалуження, винесіть частину логіки в окремі функції."),
    ("AC007", "Надмірна вкладеність", "Глибина вкладеності блоків перевищує поріг", "maintainability", "medium", 4,
     "Використовуйте ранні повернення та винесення вкладених блоків."),
    ("AC008", "Забагато параметрів", "Кількість параметрів функції перевищує поріг", "maintainability", "low", 5,
     "Згрупуйте параметри в об’єкт або структуру даних."),
    ("AC009", "Відсутній docstring", "Публічна функція або клас без документаційного рядка", "style", "info", None,
     "Додайте docstring з описом призначення."),
    ("AC010", "Жорстко закодований секрет", "Пароль або токен записано безпосередньо в коді", "security", "high", None,
     "Зберігайте секрети в змінних середовища або сховищі секретів."),
]

# email, пароль, роль
DEMO_USERS = [
    ("student@example.com", "student123", "user"),
    ("teacher@example.com", "teacher123", "teacher"),
    ("admin@example.com", "admin123", "admin"),
]

SAMPLE_CODE_V1 = '''import os
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
'''

SAMPLE_CODE_V2 = '''import sys
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
'''
