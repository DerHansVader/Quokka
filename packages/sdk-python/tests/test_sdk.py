import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from quokka import sdk


class Response:
    def __init__(self, exc=None):
        self.exc = exc

    def raise_for_status(self):
        if self.exc:
            raise self.exc


class SdkReliabilityTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_spool = sdk.SPOOL_DIR
        sdk.SPOOL_DIR = Path(self.tmp.name)

    def tearDown(self):
        sdk.SPOOL_DIR = self.old_spool
        self.tmp.cleanup()

    def make_run(self):
        run = sdk.Run(
            project="demo",
            name="run",
            config={},
            display_name=None,
            api_key="qk_test",
            base_url="http://example.test",
        )
        run.run_id = "run-1"
        run._warn = Mock()
        return run

    def test_flush_spools_http_failures(self):
        run = self.make_run()
        run._session.post = Mock(return_value=Response(RuntimeError("401 Unauthorized")))
        run._queue.put({"key": "loss", "step": 1, "value": 0.5})

        self.assertFalse(run._flush())

        files = list(sdk.SPOOL_DIR.glob("run-1_*.jsonl"))
        self.assertEqual(len(files), 1)
        self.assertEqual(json.loads(files[0].read_text().strip()), {
            "key": "loss",
            "step": 1,
            "value": 0.5,
        })
        run._warn.assert_called_once()

    def test_drain_spool_replays_and_deletes_successful_file(self):
        run = self.make_run()
        sdk.SPOOL_DIR.mkdir(parents=True, exist_ok=True)
        path = sdk.SPOOL_DIR / "run-1_1.jsonl"
        path.write_text(json.dumps({"key": "loss", "step": 1, "value": 0.5}) + "\n")
        run._session.post = Mock(return_value=Response())

        run._drain_spool_once()

        self.assertFalse(path.exists())
        run._session.post.assert_called_once_with(
            "http://example.test/api/runs/run-1/log",
            json={"points": [{"key": "loss", "step": 1, "value": 0.5}]},
        )

    def test_drain_spool_keeps_file_on_failed_replay(self):
        run = self.make_run()
        sdk.SPOOL_DIR.mkdir(parents=True, exist_ok=True)
        path = sdk.SPOOL_DIR / "run-1_1.jsonl"
        path.write_text(json.dumps({"key": "loss", "step": 1, "value": 0.5}) + "\n")
        run._session.post = Mock(return_value=Response(RuntimeError("still down")))

        run._drain_spool_once()

        self.assertTrue(path.exists())
        run._warn.assert_called_once()


if __name__ == "__main__":
    unittest.main()
