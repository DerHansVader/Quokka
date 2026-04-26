#!/usr/bin/env python3
"""
Simulate a training run so you can watch the tracker UI fill in live.

Usage:
    export QK_API_KEY=qk_...
    python examples/simulate_training.py demo
"""
import argparse
import math
import os
import random
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "packages", "sdk-python"))

import quokka


def noisy(base: float, noise: float = 0.03) -> float:
    return base + (random.random() - 0.5) * 2 * noise * max(abs(base), 0.1)


SAMPLES = [
    ("the cat sat on the mat", "the cat sat on the matt"),
    ("hello world, how are you?", "hello world how are you?"),
    ("the quick brown fox jumps over the lazy dog", "the quick brown fox jumps over a lazy dog"),
    ("to be or not to be", "to be or not to be."),
    ("machine learning is hard", "machine learning is hard"),
    ("loss decreases over time", "loss decrease over time"),
    ("<coord>42</coord>", "<coord>42</coord>"),
    ("<coord>1337</coord>", "<coord>1336</coord>"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project", help="project name (auto-created), optionally prefixed with 'team/'")
    ap.add_argument("--steps", type=int, default=5000)
    ap.add_argument("--rate", type=float, default=50, help="steps per second")
    ap.add_argument("--run", default=None, help="run name override")
    args = ap.parse_args()

    run_name = args.run or f"sim-{int(time.time()) % 10000}"
    print(f"Starting run {run_name}: {args.steps} steps @ {args.rate}/s")

    quokka.init(
        project=args.project,
        run=run_name,
        display_name=f"Simulated {run_name}",
        config={"lr": 3e-4, "batch_size": 32, "model": "qwen35", "sim": True},
    )

    interval = 1.0 / args.rate
    last_sample = 0

    for step in range(args.steps):
        progress = step / args.steps

        loss = 3.0 * math.exp(-step / 800) + 0.15 + noisy(0, 0.08)
        acc = 1 - math.exp(-step / 600) + noisy(0, 0.02)
        acc = max(0.0, min(1.0, acc))

        grad_norm = 0.5 + math.exp(-step / 1000) * 2 + noisy(0, 0.3)
        lr = 3e-4 * (1 - progress) * (0.5 + 0.5 * math.cos(step / 200))
        skip_rate = max(0.0, 0.3 * math.exp(-step / 500) + noisy(0, 0.02))

        loss_x = 0.8 * math.exp(-step / 700) + noisy(0, 0.05)
        loss_y = 0.9 * math.exp(-step / 700) + noisy(0, 0.05)
        loss_click = 0.4 * math.exp(-step / 900) + noisy(0, 0.04)

        quokka.log({
            "train/loss": loss,
            "train/accuracy": acc,
            "train/grad_norm": grad_norm,
            "train/lr": lr,
            "train/skip_rate": skip_rate,
            "loss/coord_x": loss_x,
            "loss/coord_y": loss_y,
            "loss/click": loss_click,
        }, step=step)

        if step - last_sample >= 500 or (step == args.steps - 1):
            gt, pred = random.choice(SAMPLES)
            quokka.log({"eval/sample": quokka.Sample(gt=gt, pred=pred)}, step=step)
            last_sample = step
            print(f"  step {step}: loss={loss:.3f} acc={acc:.3f}  [sample logged]")

        if step % 200 == 0 and step > 0:
            print(f"  step {step}: loss={loss:.3f} acc={acc:.3f}")

        time.sleep(interval)

    quokka.finish()
    print(f"Done. Open the run in the UI to see the final charts.")


if __name__ == "__main__":
    main()
