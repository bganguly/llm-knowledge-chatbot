# Claude Instructions — llm-knowledge-chatbot

## Copied files — sync before editing

The files below in `api/` are **copies** from sibling repos. The originals live in:

| File | Origin |
|---|---|
| `api/solution.py` | `../knowledge-system-hackathon/solution.py` |
| `api/_chunks.py` | `../knowledge-system-hackathon/_chunks.py` |
| `api/_preprocess.py` | `../knowledge-system-hackathon/_preprocess.py` |
| `api/contract.py` | `../hackathon-knowledge-kit-participant/harness/contract.py` |

**Never edit the originals** — this repo wraps them, it does not own them.

### Checking for staleness

Before working on any logic in `api/`, run:

```
./scripts/sync-from-main.sh
```

If the script prints any `SYNC` lines, the files were out of date and are now updated. Stage and commit them before proceeding.

### If the sibling repos are not present (deployed environment)

The copied files in `api/` are intentionally committed. No sync is needed at runtime. The copies are the deployed source of truth.

## No company-specific hardcoding

This repo must contain zero references to any specific company, domain, or organization name in code, comments, or configuration. The pipeline is generic. If you see any company name hardcoded in code, remove it.

## Env vars required to run

| Var | Where set | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | GCP Secret Manager (via `deploy.sh`) | Python API |
| `SNAPSHOTS_PATH` | local env / build context | Python API startup |
| `API_URL` | CF Worker secret | URL of the running Python API |
| `KNOWLEDGE_BASE_URL` | CF Worker secret | Root URL of the indexed site — not committed; see `.env.example` for the placeholder |

### CF Worker secrets — do not commit, do not use `wrangler secret put` during normal flow

Secrets (`API_URL`, `KNOWLEDGE_BASE_URL`) are set once via `wrangler secret put <VAR>` and
persist across all subsequent deploys. **Never put them in `wrangler.toml` or any committed file.**
`deploy.sh` handles code + GCP; CF Worker code deploys automatically on `git push` via CF git
integration. The only time to run `wrangler secret put` is when first provisioning or changing a
secret value. See `.env.example` for the full list of vars and their purpose.

## Running locally

Start the Python API:

```
cd api
pip install -r requirements.txt
ANTHROPIC_API_KEY=... SNAPSHOTS_PATH=... uvicorn main:app --port 8000
```

Start the CF Worker (in dev mode, pointing at local API):

```
cd worker
npm install
wrangler secret put API_URL   # enter http://localhost:8000
wrangler dev
```
