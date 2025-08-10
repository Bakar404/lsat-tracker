#!/usr/bin/env python3
"""
Outputs:
  1) merged CSV:
     exam_number, Section, Question, Subtype, Difficulty, total_time_seconds,
     question_score, Flagged, experimental_section
  2) exam metadata CSV:
     exam_number, exam_date, scaled_score

Dependencies:
  pip install "pymupdf>=1.24.0" "numpy>=1.24.0"
"""

import os
import re
import csv
import pathlib
from typing import Dict, List, Tuple, Optional
import fitz  # PyMuPDF
import numpy as np

# ---------- title parsing ----------
MONTHS = {'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3, 'apr': 4, 'april': 4,
          'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7, 'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9,
          'oct': 10, 'october': 10, 'nov': 11, 'november': 11, 'dec': 12, 'december': 12}


def _last_date_match(s: str):
    pats = [
        r'(?P<m>\d{1,2})[\/_\-](?P<d>\d{1,2})[\/_\-](?P<y>\d{4})',
        r'(?P<y>\d{4})[\/_\-](?P<m>\d{1,2})[\/_\-](?P<d>\d{1,2})',
        r'(?P<mon>[A-Za-z]{3,9})[ ,_\-]+(?P<d>\d{1,2})(?:st|nd|rd|th)?[ ,_\-]+(?P<y>\d{4})',
    ]
    last = None
    for pat in pats:
        for m in re.finditer(pat, s, flags=re.IGNORECASE):
            gd = m.groupdict()
            if 'mon' in gd and gd['mon']:
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
    pre = re.sub(r'[\s\-_/,]+$', '', s[:idx])
    m = re.search(r'(\d+)\D*$', pre)
    return m.group(1) if m else None


def parse_title_fields(pdf_path: str, doc: fitz.Document) -> Tuple[Optional[str], Optional[str]]:
    meta_title = (doc.metadata or {}).get("title") or ""
    stem = pathlib.Path(pdf_path).stem
    s = f"{meta_title} | {stem}".strip(" |")
    hit = _last_date_match(s)
    if not hit:
        return None, None
    y, mo, d, start_idx = hit
    if not (1 <= mo <= 12 and 1 <= d <= 31 and 1900 <= y <= 2100):
        return None, None
    exam_date = f"{y:04d}-{mo:02d}-{d:02d}"
    exam_number = _nearest_int_before(s, start_idx)
    return exam_number, exam_date


# ---------- text parsing ----------
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


def coalesce_space(s: str) -> str: return re.sub(r"\s+", " ", s).strip()


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
    """
    Accepts: 'Xm Ys', 'Xm', 'Ys', 'M:SS' (e.g., '8:03'), with optional spaces.
    Returns integer seconds.
    """
    s = s.strip().lower()
    s = s.replace(" ", "")
    # mm:ss
    m = re.match(r'^(?P<m>\d+):(?P<s>\d{1,2})$', s)
    if m:
        return int(m.group('m'))*60 + int(m.group('s'))
    # XmYs, Xm, Ys
    m = re.match(r'^(?:(?P<m>\d+)m)?(?:(?P<s>\d+)s)?$', s)
    if m and (m.group('m') or m.group('s')):
        minutes = int(m.group('m') or 0)
        seconds = int(m.group('s') or 0)
        return minutes*60 + seconds
    # fallback: digits only
    if s.isdigit():
        return int(s)
    return 0


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
        level = int(m.group("level").strip())  # integer Difficulty
        time_str = m.group("time").strip()
        total_sec = _time_to_seconds(time_str)

        # y-center for row & question number x1
        y_vals = [(sp["bbox"][1] + sp["bbox"][3]) * 0.5 for sp in ordered]
        row_y = sum(y_vals)/len(y_vals)
        qnum_x1 = None
        qnum_str = str(qnum)
        for sp in ordered:
            t = sp["text"].strip()
            if t == qnum_str or re.fullmatch(rf"{qnum_str}\D*", t):
                qnum_x1 = sp["bbox"][2]
                break
        if qnum_x1 is None and ordered:
            qnum_x1 = ordered[0]["bbox"][2]

        rows.append({
            "Question": qnum,
            "Subtype": subtype,
            "Difficulty": level,                 # integer
            "total_time_seconds": total_sec,     # integer seconds
            "row_y_pt": row_y,
            "qnum_x1": qnum_x1,
            **col_x
        })
    return rows

# ---------- raster ✓/✕ and flag ----------


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
        return 1  # teal-ish (✓)
    if (r >= g + 5) and (r >= b + 10):
        return 0              # orange-ish (✕)
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
    """Detect the blue-gray flag just to the RIGHT of the question number and LEFT of the Response column."""
    page_np, zoom = render_page_np(page, dpi=300)
    H, W, _ = page_np.shape
    default_resp = int(0.30 * (W/zoom))  # rough fallback

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

# ---------- main ----------


def process_pdf(pdf_path: str, out_dir: str = "output_csvs",
                merged_name: str = "all_sections_clean_scored.csv",
                exam_meta_name: str = "exam_metadata.csv"):
    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(pdf_path)

    exam_number, exam_date = parse_title_fields(pdf_path, doc)

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

        # Which section number appears on this page, and is it experimental (*)?
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
                    "Difficulty": r["Difficulty"],                 # integer
                    "total_time_seconds": r["total_time_seconds"],  # integer
                    "question_score": r.get("question_score", 0),
                    "Flagged": r.get("Flagged", "FALSE"),
                    "experimental_section": "TRUE" if info["experimental"] else "FALSE",
                })
    doc.close()

    # Strip any accidental keys
    for r in merged_rows:
        r.pop("Exam Number", None)
        r.pop("exam_number", None)
        r.pop("Total Question Time", None)  # old name, just in case

    # Write merged CSV (exam_number first)
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

    # Exam metadata CSV
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


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(
        description="Merge LSAT sections to CSVs (with score, flag, and cleaned fields).")
    ap.add_argument("pdf", help="Path to the PDF")
    ap.add_argument("--out", default="output_csvs", help="Output directory")
    ap.add_argument(
        "--merged_name", default="all_sections_clean_scored.csv", help="Merged CSV filename")
    ap.add_argument("--meta_name", default="exam_metadata.csv",
                    help="Metadata CSV filename")
    args = ap.parse_args()
    merged_csv, meta_csv = process_pdf(args.pdf, out_dir=args.out,
                                       merged_name=args.merged_name, exam_meta_name=args.meta_name)
    print("Wrote:\n -", merged_csv, "\n -", meta_csv)
