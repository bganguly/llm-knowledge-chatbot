"""Load snapshots from a directory tree that matches the hackathon kit format.

Each snapshot is a subdirectory containing manifest.json + markdown files.
"""
from __future__ import annotations

import json
import zipfile
from pathlib import Path

from contract import Page, Snapshot


def _unpack_zips(root: Path) -> None:
    zip_dir = next(
        (d for d in (root.parent / "snapshots_zip", root)
         if d.is_dir() and any(d.glob("*.zip"))),
        None,
    )
    if zip_dir is None:
        return
    root.mkdir(parents=True, exist_ok=True)
    todo = [z for z in sorted(zip_dir.glob("*.zip"))
            if not (root / z.stem / "manifest.json").exists()]
    for z in todo:
        with zipfile.ZipFile(z) as zf:
            for name in zf.namelist():
                if not (root / name).resolve().is_relative_to(root.resolve()):
                    raise RuntimeError(f"unsafe path in {z.name}: {name}")
            zf.extractall(root)


def load_snapshots(snapshots_path: str) -> list[Snapshot]:
    root = Path(snapshots_path)
    _unpack_zips(root)
    snaps: list[Snapshot] = []
    for d in sorted(p for p in root.iterdir() if p.is_dir() and (p / "manifest.json").exists()):
        manifest = json.loads((d / "manifest.json").read_text())
        pages = [
            Page(
                url=p["url"],
                title=p.get("title", ""),
                markdown=(d / p["file"]).read_text(encoding="utf-8"),
                fetched_at=p.get("fetched_at", manifest["taken_on"]),
            )
            for p in manifest["pages"]
        ]
        snaps.append(Snapshot(manifest["snapshot_id"], manifest["taken_on"], pages))
    snaps.sort(key=lambda s: s.taken_on)
    return snaps
