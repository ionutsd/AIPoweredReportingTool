# AI Reporting Assistant — Project Scaffold

A small demo app: upload any CSV/Excel file and get AI-generated insights,
ask questions about the data in plain language, and get chart suggestions.

## Structure

```
reporting-tool/
├── backend/          FastAPI app
│   ├── main.py       API routes (/upload, /insights, /chat, /chart-suggest)
│   └── app/
│       ├── profiling.py   Dynamic schema/profile inference (pandas)
│       ├── ai_service.py  Claude API calls (insights, code gen, chart specs)
│       └── sandbox.py     Restricted execution of LLM-generated pandas code
└── frontend/         React (Vite) app
    └── src/
        ├── App.jsx              Tabbed layout
        ├── api.js               API client
        └── components/
            ├── FileUpload.jsx
            ├── InsightsPanel.jsx
            ├── ChatPanel.jsx
            └── ChartPanel.jsx
```

## How it works

1. **Upload** — user drops in a CSV/XLSX file. The backend reads it with
   pandas and builds a *profile* (column types, stats, null %, top values) —
   not the raw data — and returns it along with a `session_id`.
2. **Insights** — the profile is sent to Claude, which returns a short
   plain-language summary of patterns/anomalies.
3. **Ask** — the user's question + profile go to Claude, which writes a small
   pandas snippet. That snippet runs in a restricted subprocess
   (`sandbox.py`) against the actual dataframe, and the result is returned.
4. **Charts** — the user's description + profile go to Claude, which returns
   a small JSON "chart spec" (chart type + which columns to use). The
   frontend renders it with Recharts.

## Running locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # add your ANTHROPIC_API_KEY
uvicorn main:app --reload
```

Runs on http://localhost:8000 (check http://localhost:8000/health).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173 and proxies `/api/*` to the backend.

## Notes / next steps

- **Sessions are in-memory** — fine for a demo, but data is lost on
  restart and won't work across multiple backend instances. For anything
  beyond a single-instance demo, swap `SESSIONS` for Redis or a database.
- **Sandbox is a starting point** — `sandbox.py` runs LLM-generated code in
  a separate process with a timeout and a restricted builtins list. For a
  public-facing app, consider a more isolated sandbox (container, gVisor,
  or a WASM-based runner like Pyodide).
- **Public demo disclaimer** — since anyone can upload a file, the frontend
  footer reminds users not to upload sensitive data. Worth keeping front and
  center, especially given GDPR considerations.
- **Deployment** — backend can go on Render (free tier, same as your fuel
  prices project); frontend can be a static build on GitHub Pages or
  Render's static site hosting. Update the Vite proxy / API base URL for
  production.
- **Possible additions**: multi-sheet Excel support with a sheet picker,
  a "preview detected columns" step before profiling, chat history per
  session, saving/exporting generated charts.
