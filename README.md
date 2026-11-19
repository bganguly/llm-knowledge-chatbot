cf-knowledge-query
==================

An interactive knowledge query interface backed by **BM25 retrieval** and **Claude Haiku**.
A Cloudflare Worker serves the UI and proxies queries to a **Python FastAPI** backend
that wraps the [`knowledge-system-hackathon`](https://github.com/bganguly/knowledge-system-hackathon) pipeline.
Type a question, optionally anchor it to a snapshot date, and get a grounded answer with cited sources.

* * *

Live Service
------------

| Endpoint | URL |
|---|---|
| UI | _deploy to set_ |
| Worker health | `GET /health` |
| Query API | `POST /query` |

> The Python backend ingests snapshot data at startup and keeps the BM25 index in memory.
> First request after a cold restart may be slower while snapshots load.

* * *

Using the App
-------------

1. Type a free-text question in the input box.
2. Optionally pick an **as-of date** to query the knowledge base as it stood on that day.
3. Click **Ask** — the answer streams back with a confidence badge and latency.
4. Cited source URLs appear as chips below the answer; click any to open the original page.
5. If the system detected conflicting values across snapshots, a conflict note is shown.

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
  │  API_URL secret → Python FastAPI
  ▼
FastAPI  (uvicorn, any host)
  │  SNAPSHOTS_PATH → snapshot .md files on disk
  │  ANTHROPIC_API_KEY → Anthropic Claude Haiku
  ▼
KnowledgeSystem  (BM25Okapi + Claude Haiku)
  ├── ingest()  — called once per snapshot at startup
  └── answer()  — BM25 retrieval → top-K chunks → LLM
```

Deploy flow:

```
1. python api  →  uvicorn main:app --port 8000
2. CF Worker   →  wrangler deploy  (API_URL secret points to step 1)
```

### Key design decisions

| Concern | Approach |
|---|---|
| Zero changes to main repo | `api/` holds copies of `solution.py`, `_chunks.py`, `_preprocess.py`, `contract.py`; sync script keeps them fresh |
| Generic pipeline | No company-specific URLs, query expansions, or alias tables in this repo |
| Edge UI | CF Worker serves the HTML page directly; no CDN or static-site host needed |
| Retrieval | BM25Okapi over paragraph chunks; per-URL cap and adjacent-chunk expansion run in-process |
| Temporal filtering | `as_of` date passed through to `KnowledgeSystem.answer()` unchanged |
| Secrets | `ANTHROPIC_API_KEY` in server env; `API_URL` as a CF Worker secret — neither in source |

* * *

Stack
-----

| Component | Implementation |
|---|---|
| Edge host | Cloudflare Workers |
| UI | Vanilla HTML + CSS served by Worker |
| API proxy | Cloudflare Worker fetch |
| Backend framework | Python FastAPI + uvicorn |
| Retrieval | BM25Okapi (`rank-bm25`) |
| LLM | Anthropic Claude Haiku (`claude-haiku-5-5`) |
| Python | 3.12 |

* * *

Repos
-----

| Service | Location |
|---|---|
| This repo (Worker + API wrapper) | [`cf-knowledge-query`](https://github.com/bganguly/cf-knowledge-query) |
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
ANTHROPIC_API_KEY=sk-ant-... SNAPSHOTS_PATH=/path/to/snapshots uvicorn main:app --port 8000
```

**Run the Worker in dev mode:**

```bash
cd worker
npm install
wrangler secret put API_URL
wrangler dev
```

**Deploy the Worker:**

```bash
cd worker
wrangler deploy
```

The Python API can be deployed to any host that runs Python 3.12 and can reach the Anthropic API.
Set `API_URL` to its public address as a CF Worker secret.

### Cost

| Resource | Cost |
|---|---|
| Cloudflare Worker | Free tier (100k req/day) |
| Python API host | Depends on provider; scales to zero on Railway/Render |
| Anthropic Claude Haiku | ~$0.00025 / 1K input tokens |

* * *

Features
--------

- **Temporal queries** — anchor any question to a past snapshot date with the as-of picker
- **Grounded answers** — LLM constrained to retrieved chunks; returns "I don't know" when answer is absent
- **Conflict detection** — flags when percentage values differ across snapshot dates for the same URL
- **Source chips** — every answer links to the pages it was drawn from
- **Confidence badge** — visual indicator when the system is uncertain
- **Latency display** — round-trip time shown on every response
