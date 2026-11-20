llm-knowledge-chatbot
=====================

An interactive knowledge query interface backed by **BM25 retrieval** and **Claude Haiku**.
A Cloudflare Worker serves the UI and proxies queries to a **Python FastAPI** backend
that wraps the [`knowledge-system-hackathon`](https://github.com/bganguly/knowledge-system-hackathon) pipeline.
Type a question, optionally anchor it to a snapshot date, and get a grounded answer with cited sources.

The backend runs on **GCP Cloud Run** (scale-to-zero). A prebuild step serializes the BM25 index
to a compact pickle at image build time so cold-start ingestion is fast.

* * *

Live Service
------------

| Endpoint | URL |
|---|---|
| UI | https://llm-knowledge-chatbot.gangulybikramjit.workers.dev |
| Worker health | `GET /health` |
| Query API | `POST /query` |

> The Python backend ingests snapshot data at startup from a prebuilt pickle file.
> Cold starts on Cloud Run typically take 30–120 s depending on snapshot count.
> The UI shows a "Backend waking up" banner while the backend is not ready,
> and disables the submit button until `/health` confirms readiness.

* * *

Using the App
-------------

1. Type a free-text question in the input box, or click one of the sample query chips to pre-fill it.
2. Optionally pick an **as-of date** to query the knowledge base as it stood on that day.
3. Click **Ask** (or press Enter) — the answer appears with a confidence badge and latency.
4. Cited source URLs appear as chips below the answer; click any to open the original page.
5. When the system is uncertain, the sources label notes "raw BM25 chunks, low accuracy when uncertain".
6. If the system detected conflicting values across snapshots, a conflict note is shown.

* * *

Architecture
------------

### Topology

```
Browser
  │  GET  /         → HTML UI (served by Worker)
  │  POST /query    → proxied to Python API
  ▼
Cloudflare Worker  (edge, zero cold start)
  │  API_URL secret → Python FastAPI on Cloud Run
  ▼
FastAPI  (uvicorn, GCP Cloud Run — scale to zero)
  │  SNAPSHOTS_PATH → snapshot .md files on disk
  │  ANTHROPIC_API_KEY → Anthropic Claude Haiku
  ▼
KnowledgeSystem  (BM25Okapi + Claude Haiku)
  ├── prebuild   — run once at image build time; serializes chunks to pickle
  ├── ingest()   — loads pickle at startup; bypasses per-chunk __init__ overhead
  └── answer()   — BM25 retrieval → top-K chunks → LLM
```

### Cold-start optimization

`api/prebuild.py` runs at image build time and writes a compact pickle
(`/tmp/ks_prebuilt.pkl`) containing:

- `_chunks_raw` — 6-tuples `(url, title, snapshot_id, taken_on, text, authority)` with `authority` pre-computed
- `_snapshot_dates` — snapshot-to-date mapping
- `_conflicts` — pre-detected temporal conflicts

At startup, `api/main.py` loads the pickle and reconstructs `_Chunk` objects via
`object.__new__(_Chunk)` to bypass `__init__` (which would re-compute `_url_authority` per chunk).
`_page_history` (full markdown for all pages, ~25 MB) is intentionally excluded from the pickle
since it is only used at ingest time, not at query time.

Result: pickle 44 MB → 19 MB; cold-start ingestion 203 s → 125 s.

### Key design decisions

| Concern | Approach |
|---|---|
| Zero changes to main repo | `api/` holds copies of `solution.py`, `_chunks.py`, `_preprocess.py`, `contract.py`; sync script keeps them fresh |
| Generic pipeline | No company-specific URLs, query expansions, or alias tables in this repo |
| Edge UI | CF Worker serves the HTML page directly; no CDN or static-site host needed |
| Retrieval | BM25Okapi over paragraph chunks; per-URL cap and adjacent-chunk expansion run in-process |
| Temporal filtering | `as_of` date passed through to `KnowledgeSystem.answer()` unchanged |
| Secrets | `ANTHROPIC_API_KEY` in server env; `API_URL` as a CF Worker secret — neither in source |
| Cold start | Prebuild step at image build; `object.__new__` skip of per-chunk init; `_page_history` excluded |

* * *

Stack
-----

| Component | Implementation |
|---|---|
| Edge host | Cloudflare Workers |
| UI | Vanilla HTML + CSS served by Worker |
| API proxy | Cloudflare Worker fetch |
| Backend framework | Python FastAPI + uvicorn |
| Backend host | GCP Cloud Run (scale to zero) |
| Retrieval | BM25Okapi (`rank-bm25`) |
| LLM | Anthropic Claude Haiku (`claude-haiku-5-5`) |
| Python | 3.12 |

* * *

Repos
-----

| Service | Location |
|---|---|
| This repo (Worker + API wrapper) | [`llm-knowledge-chatbot`](https://github.com/bganguly/llm-knowledge-chatbot) |
| Core pipeline (BM25 + LLM logic) | [`knowledge-system-hackathon`](https://github.com/bganguly/knowledge-system-hackathon) |

* * *

Deployment / Running
--------------------

**Keep copied files in sync** (run when the main repo changes):

```bash
./scripts/sync-from-main.sh
```

**Run the Python API locally:**

```bash
cd api
pip install -r requirements.txt
ANTHROPIC_API_KEY=... SNAPSHOTS_PATH=/path/to/snapshots uvicorn main:app --port 8000
```

**Run the Worker in dev mode:**

```bash
cd worker
npm install
wrangler secret put API_URL
wrangler dev
```

**Deploy (canonical entry point):**

```bash
./deploy.sh
```

`deploy.sh` runs the prebuild step, builds and pushes the Cloud Run image via `gcloud builds submit`,
deploys the new revision, and updates the CF Worker secret. Never run `wrangler deploy` or
individual Cloud Run commands directly.

**CF Worker auto-deploys** via Cloudflare's git integration on every push to `main`.

### Cost

| Resource | Cost |
|---|---|
| Cloudflare Worker | Free tier (100k req/day) |
| GCP Cloud Run | ~$0 at scale-to-zero; billed only during active requests |
| Anthropic Claude Haiku | ~$0.00025 / 1K input tokens |

* * *

Features
--------

- **Temporal queries** — anchor any question to a past snapshot date with the as-of picker
- **Sample chips** — click a pre-written query to fill the input instantly
- **Grounded answers** — LLM constrained to retrieved chunks; returns "I don't know" when answer is absent
- **Conflict detection** — flags when percentage values differ across snapshot dates for the same URL
- **Source chips** — every answer links to the pages it was drawn from
- **Confidence badge** — visual indicator when the system is uncertain; sources label notes low accuracy
- **Wake banner** — shows elapsed time while Cloud Run is cold-starting; submit disabled until ready
- **Latency display** — round-trip time shown on every response
