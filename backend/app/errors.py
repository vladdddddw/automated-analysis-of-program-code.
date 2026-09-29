"""Єдиний формат помилок: {"status": 404, "message": "..."}"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("codeinspector")


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _resp(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"status": status, "message": message})


def _field_message(err: dict) -> str:
    loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path")]
    msg = err.get("msg", "некоректне значення")
    return f"{'.'.join(loc)}: {msg}" if loc else msg


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        return _resp(exc.status, exc.message)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        messages = {404: "Ресурс не знайдено", 405: "Метод не підтримується"}
        return _resp(exc.status_code, messages.get(exc.status_code, str(exc.detail)))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        return _resp(422, "; ".join(_field_message(e) for e in exc.errors()) or "Некоректні дані")

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        log.exception("Необроблена помилка: %s", exc)
        return _resp(500, "Внутрішня помилка сервера")
