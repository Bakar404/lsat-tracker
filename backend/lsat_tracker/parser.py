"""Parse LawHub LSAT score-report PDFs into per-question records.

A LawHub score report lists every question of a test in a table whose header
reads ``# Response Subtype Difficulty Total Question Time``. The parser
combines two signals from each page:

* Text extraction. PyMuPDF returns positioned text spans. Spans are grouped
  into visual lines and matched against a row pattern to recover the question
  number, subtype, difficulty level and time spent on the question.
* Colour sampling. The page is rendered at 300 dpi. The colour of the response
  strip in each row tells whether the answer was correct (teal) or incorrect
  (orange), and blue-gray pixels between the question number and the Response
  column mark a flagged question.

The exam number and date come from the PDF title or the file name, and the
scaled score from the "Scaled Score: NNN" line on the first page.

The coordinates, colour thresholds and patterns in this module were calibrated
against real reports. Treat them as measured values and only change them with
real reports at hand to verify the result.
"""

from __future__ import annotations

import csv
import io
import os
import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pymupdf

__all__ = [
    "METADATA_CSV_COLUMNS",
    "QUESTION_CSV_COLUMNS",
    "ExamMetadata",
    "ParsedReport",
    "QuestionRecord",
    "ReportParseError",
    "metadata_csv",
    "parse_report",
    "parse_title_fields",
    "questions_csv",
    "time_to_seconds",
]

RENDER_DPI = 300

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}  # fmt: skip

# Checked in this order; the last match of the last pattern that matches wins.
_DATE_PATTERNS = (
    # MM/DD/YYYY, MM_DD_YYYY or MM-DD-YYYY
    re.compile(r"(?P<m>\d{1,2})[\/_\-](?P<d>\d{1,2})[\/_\-](?P<y>\d{4})", re.IGNORECASE),
    # YYYY-MM-DD, YYYY_MM_DD or YYYY/MM/DD
    re.compile(r"(?P<y>\d{4})[\/_\-](?P<m>\d{1,2})[\/_\-](?P<d>\d{1,2})", re.IGNORECASE),
    # Month D, YYYY (optionally with an ordinal suffix)
    re.compile(
        r"(?P<mon>[A-Za-z]{3,9})[ ,_\-]+(?P<d>\d{1,2})(?:st|nd|rd|th)?[ ,_\-]+(?P<y>\d{4})",
        re.IGNORECASE,
    ),
)

SECTION_HEADER_RE = re.compile(r"Section\s+(\d+)(?:\s*\(\*\))?", re.IGNORECASE)
ROW_RE = re.compile(
    r"""
    ^\s*(?P<qnum>\d{1,2})
    \s+[A-E]
    \s+(?P<subtype>.+?)
    \s+Level\s+(?P<level>\d)
    \s+(?P<time>(?:\d+\s*m)?\s*\d+\s*s|\d+\s*s|\d+\s*m|\d+:\d{2})
    \s*$""",
    re.VERBOSE,
)
HEADER_LINE_RE = re.compile(
    r"^#\s*Response\s+Subtype\s+Difficulty\s+Total\s+Question\s+Time", re.IGNORECASE
)
SCALED_SCORE_RE = re.compile(r"Scaled\s+Score:\s*(\d{2,3})", re.IGNORECASE)

QUESTION_CSV_COLUMNS = (
    "exam_number",
    "Section",
    "Question",
    "Subtype",
    "Difficulty",
    "total_time_seconds",
    "question_score",
    "Flagged",
    "experimental_section",
)
METADATA_CSV_COLUMNS = ("exam_number", "exam_date", "scaled_score")

PdfSource = bytes | bytearray | memoryview | str | os.PathLike[str]


class ReportParseError(ValueError):
    """Raised when a file cannot be read as a score report."""


@dataclass(frozen=True, slots=True)
class QuestionRecord:
    """One answered question from the report."""

    section: int
    question: int
    subtype: str
    difficulty: int
    total_time_seconds: int
    question_score: int
    """1 when the response strip is teal (correct), otherwise 0."""
    flagged: bool
    experimental_section: bool


@dataclass(frozen=True, slots=True)
class ExamMetadata:
    """Exam-level fields. Values the parser could not find are ``None``."""

    exam_number: str | None
    exam_date: str | None
    """ISO date, ``YYYY-MM-DD``."""
    scaled_score: int | None


@dataclass(frozen=True, slots=True)
class ParsedReport:
    metadata: ExamMetadata
    questions: tuple[QuestionRecord, ...]
    """Sorted by section, then question number."""


# ---------------------------------------------------------------------------
# Exam number and date from the title or file name
# ---------------------------------------------------------------------------


def _last_date_match(text: str) -> tuple[int, int, int, int] | None:
    """Return ``(year, month, day, start_index)`` of the last date found in ``text``."""
    last = None
    for pattern in _DATE_PATTERNS:
        for match in pattern.finditer(text):
            groups = match.groupdict()
            if groups.get("mon"):
                month = MONTHS.get(groups["mon"].lower())
                if month is None:
                    continue
            else:
                month = int(groups["m"])
            last = (int(groups["y"]), month, int(groups["d"]), match.start())
    return last


def _nearest_int_before(text: str, index: int) -> str | None:
    """Return the integer that ends just before ``index``, ignoring separators."""
    prefix = re.sub(r"[\s\-_/,]+$", "", text[:index])
    match = re.search(r"(\d+)\D*$", prefix)
    return match.group(1) if match else None


def _stem(name: str | None) -> str:
    """Drop the extension from a file name; return other strings unchanged."""
    if not name:
        return ""
    path = Path(name)
    return path.stem if path.suffix else str(path)


def parse_title_fields(*candidates: str | None) -> tuple[str | None, str | None]:
    """Extract ``(exam_number, exam_date)`` from title-like strings.

    The candidates (typically the PDF title and the file name without its
    extension) are joined with ``" | "``. The date is the last date found and
    the exam number is the integer immediately before it, so
    ``"LSAT Daigo 1 9_7_2024"`` yields ``("1", "2024-09-07")``. Returns
    ``(None, None)`` when no valid date is present.
    """
    text = " | ".join(candidate for candidate in candidates if candidate)
    hit = _last_date_match(text)
    if not hit:
        return None, None
    year, month, day, start = hit
    if not (1 <= month <= 12 and 1 <= day <= 31 and 1900 <= year <= 2100):
        return None, None
    return _nearest_int_before(text, start), f"{year:04d}-{month:02d}-{day:02d}"


# ---------------------------------------------------------------------------
# Text extraction and table geometry
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class _Span:
    text: str
    bbox: tuple[float, float, float, float]


@dataclass(frozen=True, slots=True)
class _Columns:
    """Left edges (in points) of the Response and Subtype header cells."""

    response_x: float | None = None
    subtype_x: float | None = None


@dataclass(frozen=True, slots=True)
class _Row:
    question: int
    subtype: str
    difficulty: int
    total_time_seconds: int
    y: float
    """Vertical centre of the row, in points."""
    qnum_x1: float | None
    """Right edge of the question number, in points."""


def _collapse_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _extract_spans(page: pymupdf.Page) -> list[_Span]:
    spans = []
    for block in page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                if span.get("bbox"):
                    spans.append(_Span(span.get("text", ""), tuple(span["bbox"])))
    return spans


def _group_lines(spans: Iterable[_Span], tolerance: float) -> dict[int, list[_Span]]:
    """Bucket spans whose top edges round to the same multiple of ``tolerance``."""
    lines: dict[int, list[_Span]] = {}
    for span in spans:
        lines.setdefault(round(span.bbox[1] / tolerance), []).append(span)
    return lines


def _find_columns(spans: list[_Span]) -> _Columns:
    """Locate the Response and Subtype columns from the table header line."""
    for line in _group_lines(spans, 2.0).values():
        ordered = sorted(line, key=lambda span: span.bbox[0])
        if not HEADER_LINE_RE.search(" ".join(span.text for span in ordered).strip()):
            continue
        response_x = subtype_x = None
        for span in ordered:
            label = span.text.strip().lower()
            if label == "response":
                response_x = span.bbox[0]
            if label == "subtype":
                subtype_x = span.bbox[0]
        return _Columns(response_x, subtype_x)
    return _Columns()


def time_to_seconds(value: str) -> int:
    """Convert ``"1:05"``, ``"1m 5s"``, ``"45s"``, ``"2m"`` or ``"90"`` to seconds.

    Unrecognised values return 0.
    """
    value = value.strip().lower().replace(" ", "")
    match = re.match(r"^(?P<m>\d+):(?P<s>\d{1,2})$", value)
    if match:
        return int(match.group("m")) * 60 + int(match.group("s"))
    match = re.match(r"^(?:(?P<m>\d+)m)?(?:(?P<s>\d+)s)?$", value)
    if match and (match.group("m") or match.group("s")):
        return int(match.group("m") or 0) * 60 + int(match.group("s") or 0)
    return int(value) if value.isdigit() else 0


def _parse_rows(page: pymupdf.Page) -> tuple[list[_Row], _Columns]:
    spans = _extract_spans(page)
    columns = _find_columns(spans)
    rows = []
    lines = _group_lines(spans, 1.5).values()
    for line in sorted(lines, key=lambda line: min(span.bbox[0] for span in line)):
        ordered = sorted(line, key=lambda span: span.bbox[0])
        match = ROW_RE.match(_collapse_whitespace(" ".join(span.text for span in ordered)))
        if not match:
            continue
        question = int(match.group("qnum"))

        qnum_x1 = None
        for span in ordered:
            text = span.text.strip()
            if text == str(question) or re.fullmatch(rf"{question}\D*", text):
                qnum_x1 = span.bbox[2]
                break
        if qnum_x1 is None and ordered:
            qnum_x1 = ordered[0].bbox[2]

        centres = [(span.bbox[1] + span.bbox[3]) * 0.5 for span in ordered]
        rows.append(
            _Row(
                question=question,
                subtype=match.group("subtype").strip(),
                difficulty=int(match.group("level").strip()),
                total_time_seconds=time_to_seconds(match.group("time").strip()),
                y=sum(centres) / len(centres),
                qnum_x1=qnum_x1,
            )
        )
    return rows, columns


def _sections_on_page(text: str) -> dict[int, bool]:
    """Map each section number mentioned on the page to whether it is starred (experimental)."""
    sections: dict[int, bool] = {}
    for match in SECTION_HEADER_RE.finditer(text):
        number = int(match.group(1))
        sections[number] = bool(re.search(rf"Section\s+{number}\s*\(\*\)", text, re.IGNORECASE))
    return sections


# ---------------------------------------------------------------------------
# Colour sampling: correctness and flags
# ---------------------------------------------------------------------------


def _render_page(page: pymupdf.Page, dpi: int = RENDER_DPI) -> tuple[np.ndarray, float]:
    """Render a page to an ``(height, width, 3)`` uint8 RGB array; also return the zoom."""
    zoom = dpi / 72.0
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(pixmap.height, pixmap.width, 3)
    return image, zoom


def _classify_response_colour(rgb: np.ndarray | None) -> int:
    """Return 1 for a teal (correct) strip and 0 for an orange (incorrect) or missing one."""
    if rgb is None:
        return 0
    r, g, b = rgb
    if (g >= r + 5) and (b >= r) and (g >= b - 10):
        return 1
    if (r >= g + 5) and (r >= b + 10):
        return 0
    return 1 if (g + b) >= (r + 5) else 0


def _sample_response_colour(
    image: np.ndarray, zoom: float, row_y: float, x_left: float, x_right: float
) -> np.ndarray | None:
    """Mean colour of the non-white pixels in the middle third of the response cell.

    Bands of increasing height around the row centre are tried in turn; the
    first band that contains coloured pixels wins.
    """
    height = image.shape[0]
    y_px = int(row_y * zoom)
    x0 = int(min(x_left, x_right) * zoom)
    x1 = int(max(x_left, x_right) * zoom)
    for half_h in (10, 16, 22):
        y0 = max(0, y_px - half_h)
        y1 = min(height, y_px + half_h)
        width = x1 - x0
        if width <= 6:
            continue
        crop = image[y0:y1, x0 + width // 3 : x1 - width // 3]
        if crop.size == 0:
            continue
        coloured = ~((crop[..., 0] > 245) & (crop[..., 1] > 245) & (crop[..., 2] > 245))
        if coloured.sum() == 0:
            continue
        return crop[coloured].reshape(-1, 3).mean(axis=0)
    return None


def _is_flagged(image: np.ndarray, zoom: float, row: _Row, response_x: float) -> bool:
    """Look for blue-gray flag pixels between the question number and the Response column."""
    if row.qnum_x1 is None:
        return False
    left_pt = row.qnum_x1 + 2
    right_pt = response_x - 2
    if right_pt <= left_pt:
        right_pt = left_pt + 8

    height = image.shape[0]
    y_px = int(row.y * zoom)
    x0 = int(left_pt * zoom)
    x1 = int(right_pt * zoom)
    for half_h in (12, 18, 24):
        y0 = max(0, y_px - half_h)
        y1 = min(height, y_px + half_h)
        crop = image[y0:y1, x0:x1]
        if crop.size == 0:
            continue
        r, g, b = crop[..., 0], crop[..., 1], crop[..., 2]
        # The channels are uint8, so the differences and the sum below wrap
        # modulo 256. The thresholds were tuned on real reports with exactly
        # this arithmetic; keep it as is.
        not_white = ~((r > 245) & (g > 245) & (b > 245))
        not_black = ~((r < 25) & (g < 25) & (b < 25))
        bluish = (b - r >= 20) & (g - r >= 10)
        midtone = r + g + b >= 150
        mask = not_white & not_black & bluish & midtone
        ratio = float(mask.sum()) / float(crop.shape[0] * crop.shape[1])
        if ratio > 0.002:
            return True
    return False


def _score_rows(page: pymupdf.Page, rows: list[_Row], columns: _Columns) -> list[tuple[int, bool]]:
    """Return ``(question_score, flagged)`` for each row, read from the rendered page."""
    image, zoom = _render_page(page)
    page_width_pt = image.shape[1] / zoom
    # Fallback column positions for pages where the header was not found.
    strip_left = columns.response_x
    if strip_left is None:
        strip_left = int(0.35 * page_width_pt)
    strip_right = columns.subtype_x
    if strip_right is None:
        strip_right = int(0.55 * page_width_pt)
    flag_limit = columns.response_x
    if flag_limit is None:
        flag_limit = int(0.30 * page_width_pt)

    results = []
    for row in rows:
        colour = _sample_response_colour(image, zoom, row.y, strip_left, strip_right)
        results.append(
            (int(_classify_response_colour(colour)), _is_flagged(image, zoom, row, flag_limit))
        )
    return results


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------


def _open_document(source: PdfSource) -> pymupdf.Document:
    try:
        if isinstance(source, (bytes, bytearray, memoryview)):
            return pymupdf.open(stream=bytes(source), filetype="pdf")
        return pymupdf.open(os.fspath(source))
    except (RuntimeError, ValueError) as exc:
        raise ReportParseError("The file could not be opened as a PDF.") from exc


def parse_report(
    source: PdfSource,
    *,
    filename: str | None = None,
    exam_number: str | None = None,
    exam_date: str | None = None,
    max_pages: int | None = None,
) -> ParsedReport:
    """Parse a LawHub score report.

    Args:
        source: PDF content, or a path to a PDF file.
        filename: Original file name. Used, together with the PDF title (and
            the file stem when ``source`` is a path), to detect the exam
            number and date.
        exam_number: Overrides the detected exam number.
        exam_date: Overrides the detected exam date (``YYYY-MM-DD``).
        max_pages: Reject documents with more pages than this.

    Raises:
        ReportParseError: The file is not a readable PDF, is password
            protected, or exceeds ``max_pages``.

    A readable PDF without a question table yields a report with no
    questions rather than an error.
    """
    document = _open_document(source)
    try:
        if document.needs_pass:
            raise ReportParseError(
                "The PDF is password protected. Save an unprotected copy and try again."
            )
        if max_pages is not None and document.page_count > max_pages:
            raise ReportParseError(
                f"The PDF has {document.page_count} pages; at most {max_pages} are supported."
            )

        path_stem = Path(source).stem if isinstance(source, (str, os.PathLike)) else None
        title = (document.metadata or {}).get("title") or ""
        number, date = parse_title_fields(title, _stem(filename), path_stem)
        if exam_number is not None:
            number = str(exam_number)
        if exam_date is not None:
            date = str(exam_date)

        scaled_score = None
        if document.page_count > 0:
            match = SCALED_SCORE_RE.search(document[0].get_text("text"))
            if match:
                scaled_score = int(match.group(1))

        questions: list[QuestionRecord] = []
        for page in document:
            text = page.get_text("text")
            if "Section" not in text:
                continue
            sections = _sections_on_page(text)
            if not sections:
                continue
            rows, columns = _parse_rows(page)
            if not rows:
                continue
            scores = _score_rows(page, rows, columns)
            # Rows are attributed to every section mentioned on the page.
            for section, experimental in sections.items():
                for row, (score, flagged) in zip(rows, scores, strict=True):
                    questions.append(
                        QuestionRecord(
                            section=section,
                            question=row.question,
                            subtype=row.subtype,
                            difficulty=row.difficulty,
                            total_time_seconds=row.total_time_seconds,
                            question_score=score,
                            flagged=flagged,
                            experimental_section=experimental,
                        )
                    )
    finally:
        document.close()

    questions.sort(key=lambda q: (q.section, q.question))
    return ParsedReport(
        metadata=ExamMetadata(exam_number=number, exam_date=date, scaled_score=scaled_score),
        questions=tuple(questions),
    )


def _csv_text(header: Iterable[str], rows: Iterable[Iterable[object]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue()


def questions_csv(report: ParsedReport) -> str:
    """Per-question CSV in the original column layout (booleans as TRUE/FALSE)."""
    exam_number = report.metadata.exam_number or ""
    return _csv_text(
        QUESTION_CSV_COLUMNS,
        (
            (
                exam_number,
                q.section,
                q.question,
                q.subtype,
                q.difficulty,
                q.total_time_seconds,
                q.question_score,
                "TRUE" if q.flagged else "FALSE",
                "TRUE" if q.experimental_section else "FALSE",
            )
            for q in report.questions
        ),
    )


def metadata_csv(report: ParsedReport) -> str:
    """Single-row exam metadata CSV; missing values are empty strings."""
    meta = report.metadata
    scaled = "" if meta.scaled_score is None else str(meta.scaled_score)
    return _csv_text(METADATA_CSV_COLUMNS, [(meta.exam_number or "", meta.exam_date or "", scaled)])
