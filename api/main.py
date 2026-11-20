"""FastAPI wrapper around KnowledgeSystem.

Reads snapshots from SNAPSHOTS_PATH at startup, then serves POST /query.
"""
from __future__ import annotations

import os
import pickle
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from _chunks import _Chunk
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


_startup_time: float = time.monotonic()
_ready_time: float | None = None


def _ingest_background():
    global _ks, _ready, _ingest_error, _ready_time
    t0 = time.monotonic()
    try:
        index_pkl = Path("/app/index.pkl")
        ks = KnowledgeSystem()
        if index_pkl.exists():
            pkl_size_kb = index_pkl.stat().st_size // 1024
            print(f"[startup] loading /app/index.pkl ({pkl_size_kb} KB) ...", flush=True)
            with open(index_pkl, "rb") as f:
                state = pickle.load(f)
            chunks_raw = state.pop("_chunks_raw", None)
            if chunks_raw is not None:
                state["_chunks_by_snapshot"] = {
                    sid: [_Chunk(url, title, snapshot_id, taken_on, text)
                          for (url, title, snapshot_id, taken_on, text) in tuples]
                    for sid, tuples in chunks_raw.items()
                }
            for attr, val in state.items():
                setattr(ks, attr, val)
            elapsed = time.monotonic() - t0
            print(f"[startup] pickle loaded in {elapsed:.2f}s — ready", flush=True)
        else:
            snapshots_path = os.environ.get("SNAPSHOTS_PATH")
            print(f"[startup] no index.pkl — full ingest from {snapshots_path}", flush=True)
            if not snapshots_path:
                _ingest_error = "SNAPSHOTS_PATH env var is required"
                return
            snaps = load_snapshots(snapshots_path)
            if not snaps:
                _ingest_error = f"No snapshots found in {snapshots_path}"
                return
            for snap in snaps:
                t_snap = time.monotonic()
                ks.ingest(snap)
                print(f"[startup] ingested {snap.snapshot_id} in {time.monotonic() - t_snap:.2f}s", flush=True)
            elapsed = time.monotonic() - t0
            print(f"[startup] full ingest done ({len(snaps)} snapshots) in {elapsed:.2f}s — ready", flush=True)
        _ks = ks
        _ready = True
        _ready_time = time.monotonic()
    except Exception as exc:
        _ingest_error = str(exc)
        print(f"[startup] FAILED after {time.monotonic() - t0:.2f}s: {exc}", flush=True)


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
    uptime = time.monotonic() - _startup_time
    return {
        "status": "ok",
        "ready": _ready,
        "error": _ingest_error,
        "uptime_s": round(uptime, 1),
        "ready_after_s": round(_ready_time - _startup_time, 1) if _ready_time else None,
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
