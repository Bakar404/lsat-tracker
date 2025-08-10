#!/usr/bin/env python3
"""
Outputs:
  1) merged CSV:
     exam_number, Section, Question, Subtype, Difficulty, total_time_seconds,
     question_score, Flagged, experimental_section
  2) exam metadata CSV:
     exam_number, exam_date, scaled_score

API-friendly:
  - Accepts an optional original filename hint to parse exam_number/exam_date.
  - Accepts optional overrides for exam_number/exam_date from the API.

Deps:
  pip install "pymupdf>=1.24.0" "numpy>=1.24.0"
"""

import os
import re
import csv
import pathlib
from typing import Dict, List, Tuple, Optional
import fitz  # PyMuPDF
import numpy as np

# ---------- title/date parsing helpers ----------

MONTHS = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3, 'apr': 4, 'april': 4,
    'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7, 'aug': 8, 'august': 8,
    'sep': 9, 'sept': 9, 'september': 9, 'oct': 10, 'october': 10,
    'nov': 11, 'november': 11, 'dec': 12, 'december': 12,
}


def _last_date_match(s: str):
    """Return (year, month, day, start_idx) for the LAST date found in s, else None."""
    patterns = [
        # MM/DD/YYYY or MM_DD_YYYY
        r'(?P<m>\d{1,2})[\/_\-](?P<d>\d{1,2})[\/_\-](?P<y>\d{4})',
        # YYYY-MM-DD or YYYY_MM_DD
        r'(?P<y>\d{4})[\/_\-](?P<m>\d{1,2})[\/_\-](?P<d>\d{1,2})',
        # Month D, YYYY
        r'(?P<mon>[A-Za-z]{3,9})[ ,_\-]+(?P<d>\d{1,2})(?:st|nd|rd|th)?[ ,_\-]+(?P<y>\d{4})',
    ]
    last = None
    for pat in patterns:
        for m in re.finditer(pat, s, flags=re.IGNORECASE):
            gd = m.groupdict()
            if 'mon' in gd and gd.get('mon'):
                mon = gd['mon'].lower()
                if mon not in MONTHS:
                    continue
                y = int(gd['y'])
                mo = MONTHS[mon]
                d = int(gd['d'])
            else:
                y = int(gd['y'])
                mo = int(gd['m'])
                d = int(gd['d'])
            last = (y, mo, d, m.start())
    return last


def _nearest_int_before(s: str, idx: int) -> Optional[str]:
    """Integer immediately before idx (ignoring spaces/punct)."""
    pre = re.sub(r'[\s\-_/,]+$', '', s[:idx])
    m = re.search(r'(\d+)\D*$', pre)
    return m.group(1) if m else None


def _stem(name_or_path: Optional[str]) -> str:
    if not name_or_path:
        return ""
    # If it's a filename with extension, drop extension; otherwise return as-is
    p = pathlib.Path(name_or_path)
    return p.stem if p.suffix else str(p)


def parse_title_fields(pdf_path: str, doc: fitz.Document, hint_name: Optional[str] = None) -> Tuple[Optional[str], Optional[str]]:
    meta_title = (doc.metadata or {}).get("title") or ""
    stem = pathlib.Path(pdf_path).stem

    def _stem(x):
        if not x:
            return ""
        p = pathlib.Path(x)
        return p.stem if p.suffix else str(p)

    # Consider (1) PDF metadata title, (2) original client filename hint, (3) actual path stem
    s = " | ".join([p for p in (meta_title, _stem(hint_name), stem) if p])

    hit = _last_date_match(s)
    if not hit:
        return None, None
    y, mo, d, start_idx = hit
    if not (1 <= mo <= 12 and 1 <= d <= 31 and 1900 <= y <= 2100):
        return None, None
    exam_date = f"{y:04d}-{mo:02d}-{d:02d}"
    exam_number = _nearest_int_before(s, start_idx)
    return exam_number, exam_date


# ---------- text parsing & geometry ----------


SECTION_HEADER_RE = re.compile(r"Section\s+(\d+)(?:\s*\(\*\))?", re.IGNORECASE)
ROW_RE = re.compile(r"""
    ^\s*(?P<qnum>\d{1,2})
    \s+[A-E]
    \s+(?P<subtype>.+?)
    \s+Level\s+(?P<level>\d)
    \s+(?P<time>(?:\d+\s*m)?\s*\d+\s*s|\d+\s*s|\d+\s*m|\d+:\d{2})
    \s*$""", re.VERBOSE)
HEADER_LINE_RE = re.compile(
    r"^#\s*Response\s+Subtype\s+Difficulty\s+Total\s+Question\s+Time", re.IGNORECASE)
SCALED_SCORE_RE = re.compile(r"Scaled\s+Score:\s*(\d{2,3})", re.IGNORECASE)


def coalesce_space(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def span_text_blocks(page: fitz.Page):
    text_dict = page.get_text("dict")
    spans = []
    for block in text_dict.get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                if span.get("bbox"):
                    spans.append({"text": span.get("text", ""),
                                 "bbox": tuple(span["bbox"])})
    return spans


def group_by_line(spans):
    lines = {}
    for s in spans:
        key = round(s["bbox"][1] / 1.5)
        lines.setdefault(key, []).append(s)
    return lines


def find_header_and_columns(spans):
    col_x = {}
    spans_by_line = {}
    for s in spans:
        key = round(s["bbox"][1] / 2.0)
        spans_by_line.setdefault(key, []).append(s)
    for _, line_spans in spans_by_line.items():
        ordered = sorted(line_spans, key=lambda x: x["bbox"][0])
        line_text = " ".join(ls["text"] for ls in ordered).strip()
        if HEADER_LINE_RE.search(line_text):
            for ls in ordered:
                t = ls["text"].strip().lower()
                if t == "response":
                    col_x["response_x"] = ls["bbox"][0]
                if t == "subtype":
                    col_x["subtype_x"] = ls["bbox"][0]
            break
    return col_x


def _time_to_seconds(s: str) -> int:
    s = s.strip().lower().replace(" ", "")
    m = re.match(r'^(?P<m>\d+):(?P<s>\d{1,2})$', s)
    if m:
        return int(m.group('m'))*60 + int(m.group('s'))
    m = re.match(r'^(?:(?P<m>\d+)m)?(?:(?P<s>\d+)s)?$', s)
    if m and (m.group('m') or m.group('s')):
        return int(m.group('m') or 0)*60 + int(m.group('s') or 0)
    return int(s) if s.isdigit() else 0


def parse_rows(page: fitz.Page):
    spans = span_text_blocks(page)
    col_x = find_header_and_columns(spans)
    rows = []
    for _, line_spans in sorted(group_by_line(spans).items(), key=lambda kv: min(sp["bbox"][0] for sp in kv[1])):
        ordered = sorted(line_spans, key=lambda s: s["bbox"][0])
        text_line = coalesce_space(" ".join(sp["text"] for sp in ordered))
        m = ROW_RE.match(text_line)
        if not m:
            continue
        qnum = int(m.group("qnum"))
        subtype = m.group("subtype").strip()
        level = int(m.group("level").strip())               # Difficulty as int
        total_sec = _time_to_seconds(m.group("time").strip())

        # y-center & qnum right edge
        y_vals = [(sp["bbox"][1] + sp["bbox"][3]) * 0.5 for sp in ordered]
        row_y = sum(y_vals)/len(y_vals)
        qnum_x1 = None
        for sp in ordered:
            t = sp["text"].strip()
            if t == str(qnum) or re.fullmatch(rf"{qnum}\D*", t):
                qnum_x1 = sp["bbox"][2]
                break
        if qnum_x1 is None and ordered:
            qnum_x1 = ordered[0]["bbox"][2]

        rows.append({
            "Question": qnum,
            "Subtype": subtype,
            "Difficulty": level,
            "total_time_seconds": total_sec,
            "row_y_pt": row_y,
            "qnum_x1": qnum_x1,
            **col_x
        })
    return rows

# ---------- raster ✓/✕ + flag ----------


def render_page_np(page: fitz.Page, dpi=300):
    zoom = dpi / 72.0
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
        pix.height, pix.width, 3)
    return arr, zoom


def classify_strip_rgb(rgb):
    if rgb is None:
        return 0
    r, g, b = rgb
    if (g >= r + 5) and (b >= r) and (g >= b - 10):
        return 1  # teal-ish ✓
    if (r >= g + 5) and (r >= b + 10):
        return 0               # orange-ish ✕
    return 1 if (g + b) >= (r + 5) else 0


def sample_band_color(page_np, zoom, row_y_pt, x_left_pt, x_right_pt):
    H, W, _ = page_np.shape
    y_px = int(row_y_pt * zoom)
    x0 = int(min(x_left_pt, x_right_pt) * zoom)
    x1 = int(max(x_left_pt, x_right_pt) * zoom)
    for half_h in (10, 16, 22):
        y0 = max(0, y_px - half_h)
        y1 = min(H, y_px + half_h)
        w = x1 - x0
        if w <= 6:
            continue
        cx0 = x0 + w//3
        cx1 = x1 - w//3
        crop = page_np[y0:y1, cx0:cx1]
        if crop.size == 0:
            continue
        mask = ~((crop[..., 0] > 245) & (
            crop[..., 1] > 245) & (crop[..., 2] > 245))
        if mask.sum() == 0:
            continue
        return crop[mask].reshape(-1, 3).mean(axis=0)
    return None


def add_scores_via_raster(page: fitz.Page, rows: List[Dict]):
    page_np, zoom = render_page_np(page, dpi=300)
    H, W, _ = page_np.shape
    default_x0 = int(0.35 * (W/zoom))
    default_x1 = int(0.55 * (W/zoom))
    for r in rows:
        left = r.get("response_x", default_x0)
        right = r.get("subtype_x",  default_x1)
        r["question_score"] = int(classify_strip_rgb(
            sample_band_color(page_np, zoom, r["row_y_pt"], left, right)))


def add_flags_via_raster(page: fitz.Page, rows: List[Dict]):
    """Detect the blue-gray flag immediately to the right of question number and left of Response."""
    page_np, zoom = render_page_np(page, dpi=300)
    H, W, _ = page_np.shape
    # fallback if we didn't find the column
    default_resp = int(0.30 * (W/zoom))

    for r in rows:
        qx1 = r.get("qnum_x1", None)
        rx = r.get("response_x", default_resp)
        if qx1 is None:
            r["Flagged"] = "FALSE"
            continue
        left_pt = qx1 + 2
        right_pt = rx - 2
        if right_pt <= left_pt:
            right_pt = left_pt + 8

        y_px = int(r["row_y_pt"] * zoom)
        x0 = int(left_pt * zoom)
        x1 = int(right_pt * zoom)
        found = False
        for half_h in (12, 18, 24):
            y0 = max(0, y_px - half_h)
            y1 = min(H, y_px + half_h)
            crop = page_np[y0:y1, x0:x1]
            if crop.size == 0:
                continue
            rch, gch, bch = crop[..., 0], crop[..., 1], crop[..., 2]
            not_white = ~((rch > 245) & (gch > 245) & (bch > 245))
            not_black = ~((rch < 25) & (gch < 25) & (bch < 25))
            bluish = (bch - rch >= 20) & (gch - rch >= 10)
            midtone = (rch + gch + bch >= 150)
            mask = not_white & not_black & bluish & midtone
            ratio = float(mask.sum()) / float(crop.shape[0]*crop.shape[1])
            if ratio > 0.002:
                found = True
                break
        r["Flagged"] = "TRUE" if found else "FALSE"

# ---------- main pipeline ----------


def process_pdf(pdf_path: str, out_dir: str = "output_csvs",
                merged_name: str = "all_sections_clean_scored.csv",
                exam_meta_name: str = "exam_metadata.csv",
                original_name_hint: Optional[str] = None,
                exam_number_override: Optional[str] = None,
                exam_date_override: Optional[str] = None):
    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(pdf_path)

    # Use metadata + original filename hint + stem
    exam_number, exam_date = parse_title_fields(
        pdf_path, doc, hint_name=original_name_hint)

    # Optional overrides from the API
    if exam_number_override is not None:
        exam_number = str(exam_number_override)
    if exam_date_override is not None:
        exam_date = str(exam_date_override)

    # Scaled score from first page
    scaled_score = ""
    if len(doc) > 0:
        m = SCALED_SCORE_RE.search(doc[0].get_text("text"))
        if m:
            scaled_score = m.group(1)

    merged_rows: List[Dict] = []
    for page in doc:
        txt = page.get_text("text")
        if "Section" not in txt:
            continue

        # Section meta (incl. experimental marker *)
        meta: Dict[int, Dict] = {}
        for m in SECTION_HEADER_RE.finditer(txt):
            n = int(m.group(1))
            starred = bool(
                re.search(rf"Section\s+{n}\s*\(\*\)", txt, re.IGNORECASE))
            meta[n] = {"experimental": starred}
        if not meta:
            m = re.search(r"Section\s+(\d+)", txt, re.IGNORECASE)
            if not m:
                continue
            n = int(m.group(1))
            starred = bool(
                re.search(rf"Section\s+{n}\s*\(\*\)", txt, re.IGNORECASE))
            meta = {n: {"experimental": starred}}

        rows = parse_rows(page)
        if not rows:
            continue

        add_scores_via_raster(page, rows)
        add_flags_via_raster(page, rows)

        for sec_num, info in meta.items():
            for r in rows:
                merged_rows.append({
                    "Section": sec_num,
                    "Question": r["Question"],
                    "Subtype": r["Subtype"],
                    "Difficulty": r["Difficulty"],               # int
                    "total_time_seconds": r["total_time_seconds"],  # int
                    "question_score": r.get("question_score", 0),
                    "Flagged": r.get("Flagged", "FALSE"),
                    "experimental_section": "TRUE" if info["experimental"] else "FALSE",
                })

    doc.close()

    # Clean stray legacy keys
    for r in merged_rows:
        r.pop("Exam Number", None)
        r.pop("exam_number", None)
        r.pop("Total Question Time", None)

    # Write merged (exam_number first)
    merged_out = os.path.join(out_dir, merged_name)
    fieldnames = [
        "exam_number",
        "Section",
        "Question",
        "Subtype",
        "Difficulty",
        "total_time_seconds",
        "question_score",
        "Flagged",
        "experimental_section",
    ]
    with open(merged_out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for r in sorted(merged_rows, key=lambda x: (x["Section"], x["Question"])):
            writer.writerow({
                "exam_number": exam_number or "",
                **r
            })

    # Write metadata
    meta_out = os.path.join(out_dir, exam_meta_name)
    with open(meta_out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
                                "exam_number", "exam_date", "scaled_score"], extrasaction="ignore")
        writer.writeheader()
        writer.writerow({
            "exam_number": exam_number or "",
            "exam_date": exam_date or "",
            "scaled_score": scaled_score or "",
        })

    return merged_out, meta_out


# ---------- CLI ----------
if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(
        description="Merge LSAT sections to CSVs (score, flag, cleaned fields).")
    ap.add_argument("pdf", help="Path to the PDF")
    ap.add_argument("--out", default="output_csvs", help="Output directory")
    ap.add_argument(
        "--merged_name", default="all_sections_clean_scored.csv", help="Merged CSV filename")
    ap.add_argument("--meta_name", default="exam_metadata.csv",
                    help="Metadata CSV filename")
    ap.add_argument("--original_name_hint", default=None,
                    help="Original client filename (e.g., 'LSAT Daigo 1 9_7_2024.pdf')")
    ap.add_argument("--exam_number", default=None, help="Override exam_number")
    ap.add_argument("--exam_date", default=None,
                    help="Override exam_date (YYYY-MM-DD)")
    args = ap.parse_args()

    merged_csv, meta_csv = process_pdf(
        args.pdf,
        out_dir=args.out,
        merged_name=args.merged_name,
        exam_meta_name=args.meta_name,
        original_name_hint=args.original_name_hint,
        exam_number_override=args.exam_number,
        exam_date_override=args.exam_date,
    )
    print("Wrote:\n -", merged_csv, "\n -", meta_csv)

# ==== API adapters (do NOT change parsing logic above) ====


def transform_file(pdf_path: str,
                   original_name: Optional[str] = None,
                   exam_number: Optional[str] = None,
                   exam_date: Optional[str] = None) -> Tuple[str, str]:
    """
    Runs process_pdf and RETURNS CSV TEXT (not file paths).
    Threads the original filename hint + optional overrides.
    """
    import tempfile
    import os
    import shutil
    tmp_out = tempfile.mkdtemp(prefix="lsat_transform_")
    try:
        merged_csv_path, meta_csv_path = process_pdf(
            pdf_path,
            out_dir=tmp_out,
            merged_name="all_sections_clean_scored.csv",
            exam_meta_name="exam_metadata.csv",
            original_name_hint=original_name,
            exam_number_override=exam_number,
            exam_date_override=exam_date,
        )
        with open(merged_csv_path, "r", encoding="utf-8") as f:
            merged_csv_text = f.read()
        with open(meta_csv_path, "r", encoding="utf-8") as f:
            meta_csv_text = f.read()
        return merged_csv_text, meta_csv_text
    finally:
        try:
            shutil.rmtree(tmp_out)
        except Exception:
            pass


def transform(pdf_bytes: bytes,
              original_name: Optional[str] = None,
              exam_number: Optional[str] = None,
              exam_date: Optional[str] = None) -> Tuple[str, str]:
    """
    Bytes entrypoint: write a temp file and delegate to transform_file().
    """
    import tempfile
    import os
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        tf.write(pdf_bytes)
        tmp_pdf = tf.name
    try:
        return transform_file(tmp_pdf,
                              original_name=original_name,
                              exam_number=exam_number,
                              exam_date=exam_date)
    finally:
        try:
            os.remove(tmp_pdf)
        except Exception:
            pass
