# LSAT Tracker

A modern, responsive dashboard for LSAT exam analysis. Upload PDF exam papers, automatically extract question data, and visualize your performance across sections and question types.

---

## ⚠️ Current Status: Supabase Project Paused

The backend Supabase project has been paused (inactive for 90+ days). The app code is safe on GitHub, but the database is inaccessible.

**👉 [See QUICK_RECOVERY.md for fast step-by-step recovery!](QUICK_RECOVERY.md)**

**tl;dr:**
1. Create new Supabase project (5 min)
2. Copy credentials to `.env.local` (2 min)
3. Run database SQL setup (3 min)
4. Deploy: `git push` (3 min)
5. Done! ✅

---

## 🚀 Live Application

**[Open LSAT Tracker →](https://Bakar404.github.io/lsat-tracker/)**

Hosted on GitHub Pages. *Note: Currently requires Supabase project recovery to function.*

---

## ⚙️ Development Setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Runs on `http://127.0.0.1:8000`

### Expose Backend Publicly (Development)

Use Cloudflare Tunnel for local testing:

```bash
brew install cloudflare/cloudflare/cloudflared
cloudflared tunnel --url http://localhost:8000
```

Copy the generated URL into the app's Transformer URL setting.

---

## ✨ Features

- **PDF Upload**: Upload LSAT practice test PDFs
- **Auto-parsing**: Extract questions, answers, accuracy, and timing
- **Performance Dashboard**: Analyze accuracy by section and subtype
- **Trend Analysis**: Track improvement across tests
- **Test Management**: Organize and delete test records
- **Admin Panel**: Approve new users and manage access
- **Authentication**: Secure Supabase auth with email confirmation

---

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + Recharts
- **Backend**: FastAPI + Python
- **Database**: Supabase (PostgreSQL)
- **Hosting**: GitHub Pages + Supabase
- **Authentication**: Supabase Auth

---

## 📚 Project Structure

```
lsat-tracker/
├── frontend/          React + Vite app
│   └── src/
│       ├── components/    UI components
│       ├── charts/        Chart visualizations
│       ├── hooks/         Data management (useData)
│       └── lib/           Supabase client
├── backend/           FastAPI image/PDF transformer
├── supabase/          Edge Functions
└── docs/              GitHub Pages build output
```

---

## 🔐 First-Time Setup

1. **Database**: Run in [Supabase SQL Editor](https://supabase.com/dashboard):

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
UPDATE profiles SET is_admin = TRUE WHERE id = 'YOUR_USER_ID';
```

2. **(Optional) Email Notifications**: Get a Resend API key and run:

```bash
supabase secrets set RESEND_API_KEY="your_key_here"
```

---

## 💡 Key Implementation Details

- **Build**: Frontend builds to `/docs` for GitHub Pages
- **Routing**: Client-side hash router for GitHub Pages compatibility
- **Deployment**: Automatic GitHub Actions on push to `main`
- **De-duplication**: Prevents duplicate questions (key: `exam|section|question`)
- **Subtypes**: Logical Reasoning and Reading Comprehension pre-configured

---

## 📄 License

MIT License
