from __future__ import annotations
import atexit
import json
import os
import queue
import sys
import threading
import time
from pathlib import Path
from typing import Any, Optional

import requests

from quokka.types import Sample, Image

_active_run: Optional[Run] = None
_api_key: Optional[str] = None
_base_url: str = os.environ.get("QK_BASE_URL", "http://localhost:4000")

SPOOL_DIR = Path.home() / ".quokka" / "spool"
BATCH_SIZE = 100
BATCH_INTERVAL_MS = 500


def login(key: str):
    global _api_key
    _api_key = key


def init(
    project: str,
    run: Optional[str] = None,
    config: Optional[dict] = None,
    display_name: Optional[str] = None,
) -> Run:
    global _active_run
    if _active_run is not None:
        _active_run.finish()

    api_key = _api_key or os.environ.get("QK_API_KEY")
    if not api_key:
        raise RuntimeError("No API key. Set QK_API_KEY or call quokka.login(key).")

    _active_run = Run(
        project=project,
        name=run,
        config=config or {},
        display_name=display_name,
        api_key=api_key,
        base_url=_base_url,
    )
    _active_run.start()
    return _active_run


def log(data: dict[str, Any], step: Optional[int] = None):
    if _active_run is None:
        raise RuntimeError("Call quokka.init() first.")
    _active_run.log(data, step)


def finish():
    global _active_run
    if _active_run:
        _active_run.finish()
        _active_run = None


class Run:
    def __init__(
        self,
        project: str,
        name: Optional[str],
        config: dict,
        display_name: Optional[str],
        api_key: str,
        base_url: str,
    ):
        self.project = project
        self.name = name
        self.config = config
        self.display_name = display_name
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.run_id: Optional[str] = None
        self._step = 0
        self._queue: queue.Queue = queue.Queue()
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._session = requests.Session()
        self._session.headers["Authorization"] = f"Bearer {api_key}"
        self._last_warning_at = 0.0

    def start(self):
        project_id = self._resolve_project(self.project)
        resp = self._session.post(
            f"{self.base_url}/api/runs",
            json={
                "projectId": project_id,
                "name": self.name,
                "displayName": self.display_name,
                "config": self.config,
            },
        )
        resp.raise_for_status()
        self.run_id = resp.json()["id"]

        self._thread = threading.Thread(target=self._drain_loop, daemon=True)
        self._thread.start()
        atexit.register(self.finish)

    def log(self, data: dict[str, Any], step: Optional[int] = None):
        if step is None:
            step = self._step
            self._step += 1
        else:
            self._step = step + 1

        for key, value in data.items():
            if isinstance(value, Sample):
                self._upload_sample(step, key, value)
            elif isinstance(value, (int, float)):
                self._queue.put({"key": key, "step": step, "value": float(value)})

    def finish(self):
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=10)
        self._flush()
        self._drain_spool_once()
        try:
            resp = self._session.post(f"{self.base_url}/api/runs/{self.run_id}/finish", json={})
            resp.raise_for_status()
        except Exception as exc:
            self._warn(f"finish failed: {exc}")

    def _resolve_project(self, project: str) -> str:
        """Project is a name/slug (auto-created) or 'team/project' to pin a team."""
        team, proj = (project.split("/", 1) if "/" in project else (None, project))
        resp = self._session.post(
            f"{self.base_url}/api/runs/ensure-project",
            json={"project": proj, **({"team": team} if team else {})},
        )
        resp.raise_for_status()
        return resp.json()["id"]

    def _drain_loop(self):
        while not self._stop.is_set():
            self._stop.wait(BATCH_INTERVAL_MS / 1000)
            if self._flush():
                self._drain_spool_once()

    def _flush(self) -> bool:
        batch = []
        try:
            while True:
                batch.append(self._queue.get_nowait())
        except queue.Empty:
            pass

        if not batch:
            return True

        ok = True
        for i in range(0, len(batch), BATCH_SIZE):
            chunk = batch[i : i + BATCH_SIZE]
            try:
                self._send_points(chunk)
            except Exception as exc:
                ok = False
                self._spool(chunk)
                self._warn(f"log upload failed; spooled {len(chunk)} points: {exc}")
        return ok

    def _send_points(self, points: list[dict]):
        resp = self._session.post(
            f"{self.base_url}/api/runs/{self.run_id}/log",
            json={"points": points},
        )
        resp.raise_for_status()

    def _upload_sample(self, step: int, key: str, sample: Sample):
        files = {}
        data = {"step": str(step), "key": key}

        if sample.gt is not None:
            data["gt"] = sample.gt
        if sample.pred is not None:
            data["pred"] = sample.pred
        if sample.image is not None:
            files["image"] = ("image.png", sample.image.to_bytes(), "image/png")

        try:
            resp = self._session.post(
                f"{self.base_url}/api/runs/{self.run_id}/samples",
                data=data,
                files=files if files else None,
            )
            resp.raise_for_status()
        except Exception as exc:
            self._warn(f"sample upload failed for {key} step {step}: {exc}")

    def _spool(self, points: list[dict]):
        SPOOL_DIR.mkdir(parents=True, exist_ok=True)
        path = SPOOL_DIR / f"{self.run_id}_{int(time.time() * 1000)}.jsonl"
        with open(path, "a") as f:
            for p in points:
                f.write(json.dumps(p) + "\n")

    def _drain_spool_once(self):
        if not self.run_id or not SPOOL_DIR.exists():
            return
        paths = sorted(SPOOL_DIR.glob(f"{self.run_id}_*.jsonl"))
        if not paths:
            return

        path = paths[0]
        try:
            points = [
                json.loads(line)
                for line in path.read_text().splitlines()
                if line.strip()
            ]
            if points:
                self._send_points(points)
            path.unlink()
        except Exception as exc:
            self._warn(f"spool replay failed for {path.name}: {exc}")

    def _warn(self, message: str):
        now = time.time()
        if now - self._last_warning_at < 30:
            return
        self._last_warning_at = now
        print(f"[quokka] {message}", file=sys.stderr)
