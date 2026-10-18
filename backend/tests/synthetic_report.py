"""Synthetic LawHub-style score reports for tests and demos.

The generated PDF reproduces the features the parser relies on rather than the
exact look of a real report:

* page 1 has "Scaled Score: NNN" and a per-section summary;
* each section has its own page with a "Section N" heading ("Section N (*)" for
  the experimental section), the table header line and one row per question;
* each row has a response strip that starts at the Response column, teal for a
  correct answer and orange for an incorrect one, with the answer letter on
  it; flagged questions get a blue-gray mark between the question number and
  the Response column;
* the exam number and date are in the PDF title.

Write a sample report with::

    python -m tests.synthetic_report sample-report.pdf
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import pymupdf

PAGE_WIDTH, PAGE_HEIGHT = 612, 792  # US Letter, in points
FONT, BOLD_FONT, FONT_SIZE = "helv", "hebo", 10

NUMBER_X, RESPONSE_X, SUBTYPE_X, DIFFICULTY_X, TIME_X = 50, 90, 190, 380, 460
STRIP_RIGHT_X = 172
HEADER_BASELINE = 110
FIRST_ROW_BASELINE = 140
ROW_PITCH = 22
# Vertical distance from a baseline to the centre of the text box PyMuPDF
# reports for 10 pt Helvetica.
TEXT_CENTRE_OFFSET = 3.88

TEAL = (0 / 255, 150 / 255, 135 / 255)
ORANGE = (237 / 255, 115 / 255, 33 / 255)
FLAG_BLUE_GRAY = (0.45, 0.55, 0.68)
MUTED = (0.4, 0.45, 0.5)

DISCLAIMER = "Synthetic report generated for testing. Not an official LawHub document."


@dataclass(frozen=True)
class SyntheticQuestion:
    number: int
    response: str
    subtype: str
    difficulty: int
    time: str
    """As printed in the report, for example "1m 25s", "45s", "2m" or "1:05"."""
    correct: bool
    flagged: bool = False


@dataclass(frozen=True)
class SyntheticSection:
    number: int
    title: str
    questions: Sequence[SyntheticQuestion]
    experimental: bool = False


def _q(number, response, subtype, difficulty, time, correct, flagged=False):
    return SyntheticQuestion(number, response, subtype, difficulty, time, correct, flagged)


def sample_sections() -> list[SyntheticSection]:
    """A small four-section test with every time format, flags and an experimental section."""
    return [
        SyntheticSection(1, "Logical Reasoning", [
            _q(1, "A", "Assumptions", 1, "1m 5s", True),
            _q(2, "C", "Strengthen or Weaken", 2, "45s", True),
            _q(3, "B", "Flaws", 3, "2m", False, flagged=True),
            _q(4, "E", "Deductions and Inference", 4, "1:35", True),
            _q(5, "D", "Matching Structure and Principles", 5, "2m 40s", False),
            _q(6, "A", "Conclusions and Disputes", 2, "58s", True, flagged=True),
            _q(7, "B", "Explain or Resolve", 3, "1m 12s", True),
            _q(8, "C", "Techniques, Roles, and Principles", 4, "1m 50s", False),
        ]),
        SyntheticSection(2, "Reading Comprehension", [
            _q(1, "B", "Law passages", 2, "1m 30s", True),
            _q(2, "D", "Law passages", 3, "1m 45s", False, flagged=True),
            _q(3, "A", "Science passages", 3, "2m 5s", True),
            _q(4, "E", "Science passages", 5, "2m 30s", False),
            _q(5, "C", "Humanities passages", 1, "55s", True),
            _q(6, "B", "Social science passages", 4, "1m 40s", True),
        ]),
        SyntheticSection(3, "Logical Reasoning", [
            _q(1, "D", "Flaws", 2, "1m 2s", True),
            _q(2, "A", "Matching Flaws", 4, "2m 15s", False, flagged=True),
            _q(3, "C", "Assumptions", 3, "1m 20s", True),
            _q(4, "B", "Strengthen or Weaken", 1, "40s", True),
            _q(5, "E", "Deductions and Inference", 5, "3m", False),
        ], experimental=True),
        SyntheticSection(4, "Logical Reasoning", [
            _q(1, "C", "Assumptions", 2, "1m 8s", True),
            _q(2, "E", "Flaws", 3, "1m 25s", True),
            _q(3, "A", "Explain or Resolve", 2, "50s", True),
            _q(4, "D", "Matching Structure and Principles", 4, "2m 10s", False, flagged=True),
            _q(5, "B", "Strengthen or Weaken", 3, "1m 15s", True),
            _q(6, "A", "Conclusions and Disputes", 5, "2m 35s", False),
            _q(7, "D", "Techniques, Roles, and Principles", 1, "47s", True),
        ]),
    ]  # fmt: skip


def _text(page, x, y, text, *, font=FONT, size=FONT_SIZE, color=(0, 0, 0)):
    page.insert_text((x, y), text, fontname=font, fontsize=size, color=color)


def _footer(page):
    _text(page, NUMBER_X, PAGE_HEIGHT - 30, DISCLAIMER, size=8, color=MUTED)


def _summary_page(doc, sections, exam_number, scaled_score):
    page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
    _text(page, NUMBER_X, 72, "Score Report", font=BOLD_FONT, size=20)
    _text(page, NUMBER_X, 100, f"PrepTest {exam_number}", size=12)
    if scaled_score is not None:
        _text(page, NUMBER_X, 130, f"Scaled Score: {scaled_score}", font=BOLD_FONT, size=14)
    y = 170
    for section in sections:
        correct = sum(q.correct for q in section.questions)
        marker = " (*)" if section.experimental else ""
        line = f"Section {section.number}{marker}  {section.title}: {correct} of "
        _text(page, NUMBER_X, y, f"{line}{len(section.questions)} correct")
        y += 18
    _footer(page)


def _section_page(doc, section):
    page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
    heading = f"Section {section.number}" + (" (*)" if section.experimental else "")
    _text(page, NUMBER_X, 60, heading, font=BOLD_FONT, size=16)
    _text(page, NUMBER_X, 80, section.title, size=11, color=MUTED)

    for x, label in (
        (NUMBER_X, "#"),
        (RESPONSE_X, "Response"),
        (SUBTYPE_X, "Subtype"),
        (DIFFICULTY_X, "Difficulty"),
        (TIME_X, "Total Question Time"),
    ):
        _text(page, x, HEADER_BASELINE, label)

    for index, question in enumerate(section.questions):
        baseline = FIRST_ROW_BASELINE + index * ROW_PITCH
        centre = baseline - TEXT_CENTRE_OFFSET
        strip = pymupdf.Rect(RESPONSE_X, centre - 7, STRIP_RIGHT_X, centre + 7)
        page.draw_rect(strip, color=None, fill=TEAL if question.correct else ORANGE)
        if question.flagged:
            flag = pymupdf.Rect(NUMBER_X + 16, centre - 5, NUMBER_X + 24, centre + 5)
            page.draw_rect(flag, color=None, fill=FLAG_BLUE_GRAY)
        _text(page, NUMBER_X, baseline, str(question.number))
        _text(page, RESPONSE_X + 6, baseline, question.response, color=(1, 1, 1))
        _text(page, SUBTYPE_X, baseline, question.subtype)
        _text(page, DIFFICULTY_X, baseline, f"Level {question.difficulty}")
        _text(page, TIME_X, baseline, question.time)
    _footer(page)


def build_report_pdf(
    sections: Sequence[SyntheticSection] | None = None,
    *,
    exam_number: int | str = 141,
    exam_date: str = "2026-10-03",
    scaled_score: int | None = 163,
    title: str | None = None,
) -> bytes:
    """Return the bytes of a synthetic score report.

    ``title`` defaults to ``"PrepTest {exam_number} - {exam_date}"``; pass an
    empty string to leave the PDF title blank.
    """
    sections = sample_sections() if sections is None else sections
    doc = pymupdf.open()
    try:
        _summary_page(doc, sections, exam_number, scaled_score)
        for section in sections:
            _section_page(doc, section)
        doc.set_metadata(
            {
                "title": f"PrepTest {exam_number} - {exam_date}" if title is None else title,
                "creator": "LSAT Tracker synthetic report generator",
            }
        )
        return doc.tobytes(garbage=3, deflate=True)
    finally:
        doc.close()


def build_text_pdf(*lines: str) -> bytes:
    """Return a valid one-page PDF that contains only the given lines of text."""
    doc = pymupdf.open()
    try:
        page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
        for index, line in enumerate(lines):
            _text(page, NUMBER_X, 72 + index * 20, line)
        return doc.tobytes()
    finally:
        doc.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write a synthetic LawHub-style score report.")
    parser.add_argument("output", type=Path, help="where to write the PDF")
    parser.add_argument("--exam-number", default="141")
    parser.add_argument("--exam-date", default="2026-10-03", help="YYYY-MM-DD")
    parser.add_argument("--scaled-score", type=int, default=163)
    args = parser.parse_args(argv)

    pdf = build_report_pdf(
        exam_number=args.exam_number, exam_date=args.exam_date, scaled_score=args.scaled_score
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(pdf)
    print(f"Wrote {args.output} ({len(pdf):,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
