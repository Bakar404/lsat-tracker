from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from lsat_tracker.api import create_app
from tests.synthetic_report import build_report_pdf

STATIC_FIXTURE = Path(__file__).parent / "fixtures" / "static"


@pytest.fixture(scope="session")
def report_pdf() -> bytes:
    """The default synthetic report: PrepTest 141, 2026-10-03, scaled score 163."""
    return build_report_pdf()


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app(static_dir=STATIC_FIXTURE)) as test_client:
        yield test_client
