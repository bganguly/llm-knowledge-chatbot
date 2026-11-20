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

| Var | Where used |
|---|---|
| `ANTHROPIC_API_KEY` | `api/main.py` → passed to `KnowledgeSystem` → Anthropic SDK |
| `SNAPSHOTS_PATH` | `api/main.py` startup — absolute path to a snapshots directory |
| `API_URL` | CF Worker secret — URL of the running Python API |

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
