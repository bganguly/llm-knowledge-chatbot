"""FastAPI wrapper around KnowledgeSystem.

Reads snapshots from SNAPSHOTS_PATH at startup, then serves POST /query.
"""
from __future__ import annotations

import os
import sys
import threading
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
_ready = False
_ingest_error: str | None = None


def _ingest_background():
    global _ks, _ready, _ingest_error
    try:
        snapshots_path = os.environ.get("SNAPSHOTS_PATH")
        if not snapshots_path:
            _ingest_error = "SNAPSHOTS_PATH env var is required"
            return
        snaps = load_snapshots(snapshots_path)
        if not snaps:
            _ingest_error = f"No snapshots found in {snapshots_path}"
            return
        ks = KnowledgeSystem()
        for snap in snaps:
            ks.ingest(snap)
        _ks = ks
        _ready = True
        print(f"Ingested {len(snaps)} snapshot(s)", flush=True)
    except Exception as exc:
        _ingest_error = str(exc)
        print(f"Ingest failed: {exc}", flush=True)


@app.on_event("startup")
def _startup():
    threading.Thread(target=_ingest_background, daemon=True).start()


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
    return {
        "status": "ok",
        "ready": _ready,
        "error": _ingest_error,
    }


@app.post("/query", response_model=QueryResponse)
def query(req: QueryRequest):
    if not _ready:
        msg = f"Still loading: {_ingest_error}" if _ingest_error else "Still ingesting snapshots, please retry shortly"
        raise HTTPException(503, msg)
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
