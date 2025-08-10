import os
import tempfile
import shutil
from typing import Tuple, Optional

# Import your transformer module (this file sits next to it)
import lsat_transformerWIP as WIP


def transform_file(pdf_path: str,
                   original_name: Optional[str] = None,
                   exam_number: Optional[str] = None,
                   exam_date: Optional[str] = None) -> Tuple[str, str]:
    """
    Calls your existing process_pdf() and returns CSV TEXT (not file paths).
    Threads original filename hint + overrides through the pipeline.
    """
    tmp_out = tempfile.mkdtemp(prefix="lsat_transform_")
    try:
        merged_csv_path, meta_csv_path = WIP.process_pdf(
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
    Bytes entrypoint: write temp PDF, then delegate to transform_file()
    """
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        tf.write(pdf_bytes)
        tmp_pdf = tf.name
    try:
        return transform_file(tmp_pdf, original_name=original_name,
                              exam_number=exam_number, exam_date=exam_date)
    finally:
        try:
            os.remove(tmp_pdf)
        except Exception:
            pass
