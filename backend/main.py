from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import uvicorn

import lsat_transformerWIP as transformer


ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://bakar404.github.io",
    "https://bakar404.github.io/lsat-tracker",
]

app = FastAPI(title="LSAT Transformer API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TransformResponse(BaseModel):
    all_sections_csv: str
    exam_metadata_csv: str


@app.get("/")
def root():
    # optional: send devs to interactive docs
    return RedirectResponse(url="/docs")


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/transform", response_model=TransformResponse)
async def transform_endpoint(
    file: UploadFile = File(...),
    exam_number: Optional[str] = Form(None),
    exam_date: Optional[str] = Form(None),
):
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    data = await file.read()
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF too large")

    try:
        rows_csv, meta_csv = transformer.transform(
            data,
            original_name=file.filename,  # browser filename hint
            exam_number=exam_number,      # optional override
            exam_date=exam_date,          # optional override
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transformer failed: {e}")

    if not rows_csv.strip() or not meta_csv.strip():
        raise HTTPException(
            status_code=500, detail="Transformer returned empty CSV(s)")

    return TransformResponse(all_sections_csv=rows_csv, exam_metadata_csv=meta_csv)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
# ignore
