"""FastAPI wrapper around KnowledgeSystem.

Reads snapshots from SNAPSHOTS_PATH at startup, then serves POST /query.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from contract import Answer
from snapshot_loader import load_snapshots
from solution import KnowledgeSystem

app = FastAPI(title="Knowledge Query API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

_ks: KnowledgeSystem | None = None


@app.on_event("startup")
def _startup():
    global _ks
    snapshots_path = os.environ.get("SNAPSHOTS_PATH")
    if not snapshots_path:
        raise RuntimeError("SNAPSHOTS_PATH env var is required")
    snaps = load_snapshots(snapshots_path)
    if not snaps:
        raise RuntimeError(f"No snapshots found in {snapshots_path}")
    _ks = KnowledgeSystem()
    for snap in snaps:
        _ks.ingest(snap)
    print(f"Ingested {len(snaps)} snapshot(s)", flush=True)


class QueryRequest(BaseModel):
    question: str
    as_of: str | None = None


class SourceOut(BaseModel):
    url: str
    quote: str | None = None


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceOut]
    confident: bool
    conflict_note: str | None
    latency_ms: int


@app.get("/health")
def health():
    return {"status": "ok", "snapshots_loaded": _ks is not None}


@app.post("/query", response_model=QueryResponse)
def query(req: QueryRequest):
    if _ks is None:
        raise HTTPException(503, "Knowledge system not ready")
    t0 = time.monotonic()
    ans: Answer = _ks.answer(req.question, as_of=req.as_of)
    ms = int((time.monotonic() - t0) * 1000)
    return QueryResponse(
        answer=ans.text,
        sources=[SourceOut(url=s.url, quote=s.quote) for s in ans.sources],
        confident=ans.confident,
        conflict_note=ans.conflict_note,
        latency_ms=ms,
    )
