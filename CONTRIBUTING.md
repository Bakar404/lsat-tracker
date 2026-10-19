# Contributing

Thank you for helping improve LSAT Tracker. This guide covers the development setup, the checks every change must pass and the conventions the code follows.

## Setup

You need Python 3.11 or newer, Node.js 22.13 or newer with npm, and make.

```sh
make install   # backend/.venv with runtime and development tools, and frontend/node_modules
make dev       # API on :8613 with auto-reload, web app on http://localhost:5183 with hot reload
```

`make dev` serves only the API on port 8613. Open the Vite dev server on port 5183, which proxies `/api` to the API. `make help` lists every target.

## Before opening a pull request

```sh
make check     # Ruff, ESLint, pytest, Vitest and a production build, as in CI
```

To fix formatting, run `.venv/bin/ruff format .` in `backend/`.

## Working on the parser

- The coordinates, colour thresholds and patterns in `backend/lsat_tracker/parser.py` were calibrated on real LawHub reports. Treat them as measured values. Refactor freely, but change a value only when you can check the result against real reports.
- Never commit a real score report. Score reports contain personal data, which is why git ignores `*.pdf`.
- Reproduce layouts in tests with `backend/tests/synthetic_report.py`:
  - `build_report_pdf()` draws a report from `SyntheticSection` and `SyntheticQuestion` values, with optional exam number, date, scaled score and title;
  - `build_text_pdf()` creates a PDF that contains only the given lines of text.

  `make sample-pdf` writes the default report to `sample-report.pdf`.
- If a real report does not parse correctly, open an issue that describes the problem. Do not attach the report unless you have removed your personal details from it.

## Working on the web app

- Pure logic lives in `frontend/src/lib`: analytics, backup validation, CSV export, sample data and the API client. Each module has Vitest tests next to it (`*.test.js`). Keep components focused on presentation.
- Exams are stored through `frontend/src/lib/storage.js`, in IndexedDB via idb-keyval. If you change the stored shape, increase `BACKUP_VERSION` in `backup.js` and keep older backups importable.
- Check every view at phone width (390 px), and keep animations behind the reduced-motion preference.

## Code style

- Python: Ruff for linting and formatting with a line length of 100. Use type hints on public functions, and docstrings for modules and for functions whose purpose is not obvious from their name.
- JavaScript: ESLint. Use function components in PascalCase files, hooks named `useSomething`, and camelCase functions and variables. Style with Tailwind utility classes; shared class strings live in `frontend/src/components/ui/styles.js`.
- Comments explain why the code does something, not what it does.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) with an imperative summary, for example:

- `feat: add a filter for answer time`
- `fix: keep the selected exams after an import`
- `refactor: ...`, `test: ...`, `docs: ...`, `ci: ...` and `chore: ...` for other changes

## Manual test checklist

After user-facing changes, run through this list in a fresh browser profile with the developer console open:

- [ ] `make run` works from a clean clone, and the page loads without console errors.
- [ ] **Explore with sample data** loads six labelled exams, every chart renders, and the filters update the cards, charts and question table.
- [ ] Uploading `sample-report.pdf` (from `make sample-pdf`) detects exam 141, dated 2026-10-03, with a scaled score of 163, and saving it adds 26 questions.
- [ ] Uploading a file that is not a PDF shows a clear error.
- [ ] Running **Export backup (JSON)**, **Delete all data** and then **Import backup (JSON)** restores every exam.
- [ ] **Export all questions (CSV)** opens correctly in a spreadsheet.
- [ ] Deleting an exam on the Exams page removes it from the dashboard.
- [ ] Every view works at 390 by 844 pixels without horizontal scrolling.
- [ ] Dialogs work with the keyboard and close with Escape.
