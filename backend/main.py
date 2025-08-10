from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# import your transformer code file (same folder)
# Expect a function transform(pdf_bytes) -> (all_sections_csv_text, exam_metadata_csv_text)
import lsat_transformerWIP as transformer

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://bakar404.github.io"
]

app = FastAPI(title="LSAT Transformer API", version="0.1.0")
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

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.post("/transform", response_model=TransformResponse)
async def transform_endpoint(file: UploadFile = File(...)):
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF too large")

    try:
        all_rows_csv, meta_csv = transformer.transform(data)  # adjust if your function name differs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transformer failed: {e}")

    if not all_rows_csv or not meta_csv:
        raise HTTPException(status_code=500, detail="Transformer returned empty CSV(s)")

    return TransformResponse(
        all_sections_csv=all_rows_csv,
        exam_metadata_csv=meta_csv
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
