"""HTTP API tests using FastAPI's TestClient."""

import pytest
from fastapi.testclient import TestClient

from lsat_tracker import __version__
from lsat_tracker.api import create_app
from tests.conftest import STATIC_FIXTURE
from tests.synthetic_report import build_text_pdf


def _upload(client, content, *, name="PrepTest 141.pdf", content_type="application/pdf", **form):
    return client.post("/api/transform", files={"file": (name, content, content_type)}, data=form)


def test_health(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}


def test_transform_returns_rows_and_metadata(client, report_pdf):
    response = _upload(client, report_pdf)

    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "PrepTest 141.pdf"
    assert body["metadata"] == {
        "exam_number": "141",
        "exam_date": "2026-10-03",
        "scaled_score": 163,
    }
    assert len(body["rows"]) == 26
    assert body["rows"][2] == {
        "section": 1,
        "question": 3,
        "subtype": "Flaws",
        "difficulty": 3,
        "total_time_seconds": 120,
        "question_score": 0,
        "flagged": True,
        "experimental_section": False,
    }
    assert {row["section"] for row in body["rows"] if row["experimental_section"]} == {3}


def test_transform_applies_overrides_and_ignores_blank_ones(client, report_pdf):
    overridden = _upload(client, report_pdf, exam_number="77", exam_date="2026-02-01")
    blank = _upload(client, report_pdf, exam_number="", exam_date="  ")

    assert overridden.json()["metadata"]["exam_number"] == "77"
    assert overridden.json()["metadata"]["exam_date"] == "2026-02-01"
    assert blank.json()["metadata"]["exam_number"] == "141"
    assert blank.json()["metadata"]["exam_date"] == "2026-10-03"


@pytest.mark.parametrize(
    ("name", "content", "content_type", "status", "message"),
    [
        ("notes.txt", b"hello", "text/plain", 415, "Only PDF files"),
        ("report.pdf", b"%PDF-1.7", "image/png", 415, "Expected a PDF"),
        ("report.pdf", b"just some text", "application/pdf", 415, "does not look like a PDF"),
        ("report.pdf", b"", "application/pdf", 400, "empty"),
        ("report.pdf", b"%PDF-1.7\n truncated", "application/pdf", 422, "could not be opened"),
    ],
    ids=["extension", "content-type", "magic-bytes", "empty", "corrupt"],
)
def test_transform_rejects_bad_uploads(client, name, content, content_type, status, message):
    response = _upload(client, content, name=name, content_type=content_type)

    assert response.status_code == status
    assert message in response.json()["detail"]


def test_transform_explains_when_a_pdf_has_no_questions(client):
    response = _upload(client, build_text_pdf("Monthly bank statement", "Section 1"))

    assert response.status_code == 422
    assert "No question rows were found" in response.json()["detail"]


@pytest.mark.parametrize("exam_date", ["2026-02-30", "02/01/2026", "soon"])
def test_transform_rejects_invalid_dates(client, report_pdf, exam_date):
    response = _upload(client, report_pdf, exam_date=exam_date)

    assert response.status_code == 422
    assert "YYYY-MM-DD" in response.json()["detail"]


def test_transform_enforces_the_size_limit(report_pdf):
    with TestClient(create_app(static_dir=STATIC_FIXTURE, max_upload_bytes=1024)) as client:
        response = _upload(client, report_pdf)

    assert response.status_code == 413
    assert "upload limit" in response.json()["detail"]


def test_serves_the_web_app(client):
    response = client.get("/")

    assert response.status_code == 200
    assert "static test build" in response.text
    assert response.headers["cache-control"] == "no-cache"


def test_unknown_api_paths_return_json_errors(client):
    unknown = client.get("/api/does-not-exist")
    wrong_method = client.get("/api/transform")

    assert unknown.status_code == 404
    assert unknown.json() == {"detail": "Unknown API endpoint: /api/does-not-exist"}
    assert wrong_method.status_code == 405
    assert wrong_method.headers["allow"] == "POST"


def test_explains_how_to_build_a_missing_frontend():
    app = create_app(static_dir=STATIC_FIXTURE / "missing")
    with TestClient(app) as client:
        response = client.get("/")

    assert response.status_code == 503
    assert "make run" in response.text
