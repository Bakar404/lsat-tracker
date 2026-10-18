"""Parser tests against synthetic LawHub-style reports (see tests/synthetic_report.py)."""

import pymupdf
import pytest

from lsat_tracker.parser import (
    ExamMetadata,
    ReportParseError,
    metadata_csv,
    parse_report,
    parse_title_fields,
    questions_csv,
    time_to_seconds,
)
from tests.synthetic_report import (
    SyntheticQuestion,
    SyntheticSection,
    build_report_pdf,
    build_text_pdf,
    sample_sections,
)


def _keys(questions, predicate):
    return {(q.section, q.question) for q in questions if predicate(q)}


def _expected_keys(predicate):
    return {
        (section.number, q.number)
        for section in sample_sections()
        for q in section.questions
        if predicate(q)
    }


def test_reads_every_question_with_its_attributes(report_pdf):
    report = parse_report(report_pdf)
    expected = [
        (section.number, q.number, q.subtype, q.difficulty)
        for section in sample_sections()
        for q in section.questions
    ]

    assert [(q.section, q.question, q.subtype, q.difficulty) for q in report.questions] == expected


def test_reads_correctness_from_the_response_strip_colour(report_pdf):
    report = parse_report(report_pdf)

    assert _keys(report.questions, lambda q: q.question_score == 1) == _expected_keys(
        lambda q: q.correct
    )
    assert _keys(report.questions, lambda q: q.question_score == 0) == _expected_keys(
        lambda q: not q.correct
    )


def test_detects_flag_marks(report_pdf):
    report = parse_report(report_pdf)

    flagged = _keys(report.questions, lambda q: q.flagged)
    assert flagged == _expected_keys(lambda q: q.flagged)
    assert flagged == {(1, 3), (1, 6), (2, 2), (3, 2), (4, 4)}


def test_marks_the_starred_section_as_experimental(report_pdf):
    report = parse_report(report_pdf)

    assert {q.section for q in report.questions if q.experimental_section} == {3}


def test_converts_every_time_format(report_pdf):
    times = {
        (q.section, q.question): q.total_time_seconds for q in parse_report(report_pdf).questions
    }

    assert times[(1, 1)] == 65  # "1m 5s"
    assert times[(1, 2)] == 45  # "45s"
    assert times[(1, 3)] == 120  # "2m"
    assert times[(1, 4)] == 95  # "1:35"


def test_reads_metadata_from_title_and_first_page(report_pdf):
    report = parse_report(report_pdf)

    assert report.metadata == ExamMetadata(
        exam_number="141", exam_date="2026-10-03", scaled_score=163
    )


def test_falls_back_to_the_file_name_for_exam_number_and_date():
    pdf = build_report_pdf(title="")

    report = parse_report(pdf, filename="LSAT Daigo 88 3_14_2026.pdf")

    assert (report.metadata.exam_number, report.metadata.exam_date) == ("88", "2026-03-14")


def test_overrides_replace_detected_values(report_pdf):
    report = parse_report(report_pdf, exam_number="200", exam_date="2026-01-31")

    assert (report.metadata.exam_number, report.metadata.exam_date) == ("200", "2026-01-31")


def test_missing_scaled_score_is_none():
    report = parse_report(build_report_pdf(scaled_score=None))

    assert report.metadata.scaled_score is None
    assert report.questions


def test_incorrect_unflagged_and_flagged_correct_are_independent():
    sections = [
        SyntheticSection(
            1,
            "Logical Reasoning",
            [
                SyntheticQuestion(1, "A", "Flaws", 2, "1m", correct=True, flagged=True),
                SyntheticQuestion(2, "B", "Flaws", 2, "1m", correct=False, flagged=False),
            ],
        )
    ]
    report = parse_report(build_report_pdf(sections))

    assert [(q.question_score, q.flagged) for q in report.questions] == [(1, True), (0, False)]


def test_pdf_without_a_question_table_has_no_questions():
    pdf = build_text_pdf("Section 1", "Scaled Score: 150", "Nothing else here.")

    report = parse_report(pdf)

    assert report.questions == ()
    assert report.metadata.scaled_score == 150


@pytest.mark.parametrize(
    "data",
    [b"", b"not a pdf at all", b"%PDF-1.7\n truncated"],
    ids=["empty", "text", "truncated"],
)
def test_unreadable_input_raises(data):
    with pytest.raises(ReportParseError, match="could not be opened"):
        parse_report(data)


def test_password_protected_pdf_raises():
    doc = pymupdf.open()
    doc.new_page()
    pdf = doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="user-pw", owner_pw="owner")
    doc.close()

    with pytest.raises(ReportParseError, match="password protected"):
        parse_report(pdf)


def test_page_limit(report_pdf):
    with pytest.raises(ReportParseError, match="at most 2"):
        parse_report(report_pdf, max_pages=2)


@pytest.mark.parametrize(
    ("value", "seconds"),
    [
        ("1m 25s", 85),
        ("1m25s", 85),
        ("45s", 45),
        ("2m", 120),
        ("1:05", 65),
        ("90", 90),
        ("", 0),
        ("n/a", 0),
    ],
)
def test_time_to_seconds(value, seconds):
    assert time_to_seconds(value) == seconds


@pytest.mark.parametrize(
    ("candidates", "expected"),
    [
        (("LSAT Daigo 1 9_7_2024",), ("1", "2024-09-07")),
        (("PrepTest 140 - 2024-09-07",), ("140", "2024-09-07")),
        (("PT 152 September 14th, 2025",), ("152", "2025-09-14")),
        (("Score Report", "LSAT 141 10-3-2026"), ("141", "2026-10-03")),
        (("Practice test 9/7/2024",), (None, "2024-09-07")),
        (("PT 12 13/45/2024",), (None, None)),
        (("Score Report", None, ""), (None, None)),
    ],
)
def test_parse_title_fields(candidates, expected):
    assert parse_title_fields(*candidates) == expected


def test_csv_output_keeps_the_original_layout(report_pdf):
    report = parse_report(report_pdf)

    lines = questions_csv(report).splitlines()
    assert lines[0] == (
        "exam_number,Section,Question,Subtype,Difficulty,total_time_seconds,"
        "question_score,Flagged,experimental_section"
    )
    assert lines[3] == "141,1,3,Flaws,3,120,0,TRUE,FALSE"
    assert len(lines) == 1 + len(report.questions)
    assert metadata_csv(report) == "exam_number,exam_date,scaled_score\r\n141,2026-10-03,163\r\n"
