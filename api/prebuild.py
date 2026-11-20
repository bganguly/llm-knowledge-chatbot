"""Run at Docker build time to pre-process snapshots and cache the result.

Writes /app/index.pkl containing the processed KnowledgeSystem state so
runtime startup loads in seconds instead of re-tokenizing 3000+ pages.
"""
import os
import sys
import pickle
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
os.environ.setdefault("ANTHROPIC_API_KEY", "prebuild-placeholder")

from snapshot_loader import load_snapshots
from solution import KnowledgeSystem

snapshots_path = os.environ.get("SNAPSHOTS_PATH", "/app/snapshots")
out_path = Path("/app/index.pkl")

print(f"Pre-building index from {snapshots_path} ...", flush=True)
snaps = load_snapshots(snapshots_path)
if not snaps:
    print("No snapshots — skipping", flush=True)
    sys.exit(0)

ks = KnowledgeSystem()
for snap in snaps:
    ks.ingest(snap)
    print(f"  ingested {snap.snapshot_id}", flush=True)

chunks_raw = {
    sid: [(c.url, c.title, c.snapshot_id, c.taken_on, c.text) for c in chunks]
    for sid, chunks in ks._chunks_by_snapshot.items()
}
total_chunks = sum(len(v) for v in chunks_raw.values())
print(f"  chunks: {len(chunks_raw)} snapshots, {total_chunks} total chunks", flush=True)

state = {
    "_chunks_raw":     chunks_raw,
    "_snapshot_dates": ks._snapshot_dates,
    "_page_history":   ks._page_history,
    "_conflicts":      ks._conflicts,
}
with open(out_path, "wb") as f:
    pickle.dump(state, f, protocol=pickle.HIGHEST_PROTOCOL)

print(f"Saved {out_path} ({out_path.stat().st_size // 1024} KB)", flush=True)
