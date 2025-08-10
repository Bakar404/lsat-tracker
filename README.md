# LSAT Tracker

Dashboard website to upload LSAT exam PDFs, transform them into CSVs, and visualize strengths/weaknesses by section and subtype.

## Live URL
- GitHub Pages: https://Bakar404.github.io/lsat-tracker/

## Frontend (Vite + React)
cd frontend
npm ci
npm run dev
- Set Transformer URL in the app to your backend endpoint (see below).
- Sign in (demo auth), click **Transform & Upload Test**, pick a PDF.

## Backend (FastAPI)
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
- Health: http://127.0.0.1:8000/healthz
- Transform: POST `/transform` with form field `file` (PDF).

### Free public URL via Cloudflare Tunnel (no recurring cost)
- Install `cloudflared`, run `cloudflared tunnel --url http://localhost:8000`
- Copy the provided https URL into the app’s Transformer URL box.

## Notes
- Frontend builds for GitHub Pages (base: `/lsat-tracker/`).
- De-dup logic prevents duplicate question rows on re-upload (key: exam|section|question).
- LR and RC subtype lists are built-in, so missing categories still show (as zero) in visuals.
