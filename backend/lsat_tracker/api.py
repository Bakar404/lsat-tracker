"""FastAPI application: the report parsing API plus the built web app.

One process serves everything:

* ``GET  /api/health``     liveness check
* ``POST /api/transform``  parse an uploaded score report PDF
* ``GET  /``               the React app from ``frontend/dist`` (if built)

In API-only mode (``make dev``), ``/`` points to the Vite dev server instead.

Uploads are read into memory, parsed and discarded. Nothing is stored on the
server; the browser keeps the parsed results.
"""

from __future__ import annotations

import datetime as dt
import os
import re
import threading
from pathlib import Path
from typing import Annotated

import pymupdf
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.routing import APIRoute
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.types import Scope

from . import __version__
from .parser import ParsedReport, ReportParseError, parse_report

DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_PAGES = 100
MAX_EXAM_NUMBER_LENGTH = 40
PDF_CONTENT_TYPES = frozenset({"application/pdf", "application/x-pdf", "application/octet-stream"})
STATIC_DIR_ENV = "LSAT_TRACKER_STATIC_DIR"
API_ONLY_ENV = "LSAT_TRACKER_API_ONLY"
DEFAULT_STATIC_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"

NO_QUESTIONS_MESSAGE = (
    "No question rows were found in this PDF. Upload the LawHub score report that lists "
    "every question in a table with the columns '# Response Subtype Difficulty Total "
    "Question Time'."
)

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# PyMuPDF is not thread-safe, so parses run one at a time.
_parse_lock = threading.Lock()

# Broken PDFs are reported to the client; MuPDF's own stderr output is noise.
pymupdf.TOOLS.mupdf_display_errors(False)
pymupdf.TOOLS.mupdf_display_warnings(False)


class Health(BaseModel):
    status: str = Field(examples=["ok"])
    version: str


class QuestionRow(BaseModel):
    section: int
    question: int
    subtype: str
    difficulty: int = Field(description="LawHub difficulty level, 1 (easiest) to 5")
    total_time_seconds: int
    question_score: int = Field(description="1 if answered correctly, otherwise 0")
    flagged: bool
    experimental_section: bool


class ExamMetadataOut(BaseModel):
    exam_number: str | None
    exam_date: str | None = Field(description="YYYY-MM-DD")
    scaled_score: int | None


class TransformResponse(BaseModel):
    filename: str
    metadata: ExamMetadataOut
    rows: list[QuestionRow]


class ErrorResponse(BaseModel):
    detail: str


def resolve_static_dir(static_dir: str | os.PathLike[str] | None = None) -> Path:
    """Directory of the built frontend: argument, then environment variable, then default."""
    return Path(static_dir or os.environ.get(STATIC_DIR_ENV) or DEFAULT_STATIC_DIR)


def _clean_exam_number(value: str | None) -> str | None:
    value = (value or "").strip()
    if not value:
        return None
    if len(value) > MAX_EXAM_NUMBER_LENGTH:
        raise HTTPException(
            422, f"exam_number must be at most {MAX_EXAM_NUMBER_LENGTH} characters."
        )
    return value


def _clean_exam_date(value: str | None) -> str | None:
    value = (value or "").strip()
    if not value:
        return None
    try:
        if not _ISO_DATE_RE.match(value):
            raise ValueError(value)
        dt.date.fromisoformat(value)
    except ValueError:
        raise HTTPException(422, "exam_date must be a valid date in YYYY-MM-DD format.") from None
    return value


def _parse_exclusively(data: bytes, filename: str, number: str | None, date: str | None):
    with _parse_lock:
        return parse_report(
            data, filename=filename, exam_number=number, exam_date=date, max_pages=MAX_PAGES
        )


def _to_response(filename: str, report: ParsedReport) -> TransformResponse:
    meta = report.metadata
    return TransformResponse(
        filename=filename,
        metadata=ExamMetadataOut(
            exam_number=meta.exam_number,
            exam_date=meta.exam_date,
            scaled_score=meta.scaled_score,
        ),
        rows=[
            QuestionRow(
                section=q.section,
                question=q.question,
                subtype=q.subtype,
                difficulty=q.difficulty,
                total_time_seconds=q.total_time_seconds,
                question_score=q.question_score,
                flagged=q.flagged,
                experimental_section=q.experimental_section,
            )
            for q in report.questions
        ],
    )


class _WebApp(StaticFiles):
    """The built frontend. Vite fingerprints everything under ``assets/``, so
    those files can be cached for good, while HTML is revalidated so that a
    rebuild is picked up on the next page load."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        if response.status_code == 200 and Path(path).parts[:1] == ("assets",):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-cache"
        return response


def _notice_page(body: str) -> str:
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>LSAT Tracker</title>
<style>
body{{font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;
color:#0f172a;line-height:1.5}}
code{{background:#f1f5f9;padding:.1rem .3rem;border-radius:.25rem}}
</style>
</head><body><h1>LSAT Tracker</h1>
{body}
</body></html>"""


_FRONTEND_MISSING_HTML = _notice_page(
    """<p>The API is running, but the web app has not been built yet.</p>
<p>Run <code>make run</code> from the repository root, or build it manually with
<code>npm --prefix frontend ci &amp;&amp; npm --prefix frontend run build</code>, then reload.</p>
<p>During development, use <code>make dev</code> and open the Vite dev server instead.</p>"""
)

_API_ONLY_HTML = _notice_page(
    """<p>This process serves only the API, for development with <code>make dev</code>.</p>
<p>Open the web app from the Vite dev server, <code>http://localhost:5183</code> by default.
The API reference is at <a href="/api/docs"><code>/api/docs</code></a>.</p>"""
)


def create_app(
    *,
    static_dir: str | os.PathLike[str] | None = None,
    max_upload_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
    api_only: bool | None = None,
) -> FastAPI:
    """Build the application.

    ``static_dir`` defaults to ``frontend/dist``. With ``api_only`` (default: the
    ``LSAT_TRACKER_API_ONLY=1`` environment variable) the web app is not served.
    """
    if api_only is None:
        api_only = os.environ.get(API_ONLY_ENV) == "1"
    app = FastAPI(
        title="LSAT Tracker",
        version=__version__,
        summary="Parse LawHub LSAT score reports into per-question data.",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    limit_mb = max_upload_bytes / (1024 * 1024)
    too_large = f"The file is larger than the {limit_mb:g} MB upload limit."

    @app.get("/api/health", response_model=Health, tags=["meta"])
    async def health() -> Health:
        return Health(status="ok", version=__version__)

    @app.post(
        "/api/transform",
        response_model=TransformResponse,
        tags=["reports"],
        responses={
            400: {"model": ErrorResponse, "description": "Empty upload"},
            413: {"model": ErrorResponse, "description": "File too large"},
            415: {"model": ErrorResponse, "description": "Not a PDF"},
            422: {"model": ErrorResponse, "description": "Unreadable PDF or no questions"},
        },
    )
    async def transform(
        file: Annotated[UploadFile, File(description="LawHub score report (PDF)")],
        exam_number: Annotated[str | None, Form(description="Override the exam number")] = None,
        exam_date: Annotated[str | None, Form(description="Override the date, YYYY-MM-DD")] = None,
    ) -> TransformResponse:
        """Parse a score report and return one row per question plus exam metadata."""
        try:
            filename = Path(file.filename or "").name
            if not filename.lower().endswith(".pdf"):
                raise HTTPException(
                    415, "Only PDF files are supported. Save the score report as a .pdf file."
                )
            content_type = (file.content_type or "").split(";")[0].strip().lower()
            if content_type and content_type not in PDF_CONTENT_TYPES:
                raise HTTPException(415, f"Expected a PDF upload, got '{content_type}'.")
            data = await file.read(max_upload_bytes + 1)
        finally:
            await file.close()

        if not data:
            raise HTTPException(400, "The uploaded file is empty.")
        if len(data) > max_upload_bytes:
            raise HTTPException(413, too_large)
        if b"%PDF-" not in data[:1024]:
            raise HTTPException(415, "The file does not look like a PDF.")

        number = _clean_exam_number(exam_number)
        date = _clean_exam_date(exam_date)
        try:
            report = await run_in_threadpool(_parse_exclusively, data, filename, number, date)
        except ReportParseError as exc:
            raise HTTPException(422, str(exc)) from None
        if not report.questions:
            raise HTTPException(422, NO_QUESTIONS_MESSAGE)
        return _to_response(filename, report)

    @app.api_route(
        "/api/{path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        include_in_schema=False,
    )
    async def api_not_found(request: Request, path: str) -> JSONResponse:
        for route in request.app.routes:
            if isinstance(route, APIRoute) and route.path == f"/api/{path}":
                allowed = ", ".join(sorted(route.methods))
                return JSONResponse(
                    {"detail": "Method Not Allowed"}, status_code=405, headers={"Allow": allowed}
                )
        return JSONResponse({"detail": f"Unknown API endpoint: /api/{path}"}, status_code=404)

    web_root = resolve_static_dir(static_dir)
    if api_only:

        @app.get("/", include_in_schema=False)
        async def api_only_notice() -> HTMLResponse:
            return HTMLResponse(_API_ONLY_HTML)

    elif (web_root / "index.html").is_file():
        app.mount("/", _WebApp(directory=web_root, html=True), name="web")
    else:

        @app.get("/", include_in_schema=False)
        async def frontend_missing() -> HTMLResponse:
            return HTMLResponse(_FRONTEND_MISSING_HTML, status_code=503)

    return app
