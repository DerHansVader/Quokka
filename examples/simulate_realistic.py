#!/usr/bin/env python3
"""
Simulate a realistic LLM training run. Noisier and closer to real dynamics:

  - LR: linear warmup -> cosine decay
  - Loss: AR(1) noise around an exponential floor + rare gradient spikes
  - Grad norm: correlated with loss residual, hard clipped at 1.0
  - Validation: periodic sampling with mild late-stage overfitting
  - Throughput: baseline + sharp dips during checkpoint/eval ticks
  - GPU memory: slow drift

Usage:
    export QK_API_KEY=qk_...
    python examples/simulate_realistic.py demo --steps 8000
"""
import argparse
import math
import os
import random
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "packages", "sdk-python"))

import quokka


SAMPLES = [
    ("the cat sat on the mat", "the cat sat on the matt"),
    ("hello world, how are you?", "hello world how are you?"),
    ("the quick brown fox jumps over the lazy dog", "the quick brown fox jumps over a lazy dog"),
    ("to be or not to be", "to be or not to be."),
    ("machine learning is hard", "machine learning is hard"),
    ("<coord>42</coord>", "<coord>42</coord>"),
    ("<coord>1337</coord>", "<coord>1336</coord>"),
]


def ar1(prev: float, target: float, persistence: float, noise: float) -> float:
    """AR(1) pulled toward `target`."""
    return persistence * prev + (1 - persistence) * target + random.gauss(0, noise)


def lr_schedule(step: int, total: int, peak: float, warmup_frac: float = 0.05, floor_frac: float = 0.05) -> float:
    warmup = max(1, int(total * warmup_frac))
    if step < warmup:
        return peak * (step + 1) / warmup
    progress = (step - warmup) / max(1, total - warmup)
    cosine = 0.5 * (1 + math.cos(math.pi * progress))
    return peak * (floor_frac + (1 - floor_frac) * cosine)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project", help="project name (auto-created); optionally 'team/project'")
    ap.add_argument("--steps", type=int, default=8000)
    ap.add_argument("--rate", type=float, default=80, help="steps per second")
    ap.add_argument("--epochs", type=int, default=4)
    ap.add_argument("--run", default=None)
    args = ap.parse_args()

    total = args.steps
    steps_per_epoch = max(1, total // args.epochs)
    peak_lr = 3e-4
    batch_size = 32
    seq_len = 2048

    run_name = args.run or f"real-{int(time.time()) % 10000}"
    print(f"Starting run {run_name}: {total} steps @ {args.rate}/s, {args.epochs} epochs")

    quokka.init(
        project=args.project,
        run=run_name,
        display_name=f"Realistic {run_name}",
        config={
            "lr": peak_lr,
            "batch_size": batch_size,
            "seq_len": seq_len,
            "schedule": "cosine",
            "warmup_frac": 0.05,
            "model": "qwen3-8b",
            "optim": "adamw",
            "seed": random.randint(0, 9999),
        },
    )

    interval = 1.0 / args.rate
    loss = 4.2
    grad_norm = 5.0
    throughput = 4200.0
    gpu_mem = 38.0
    last_sample = -1

    try:
        for step in range(total):
            epoch = step / steps_per_epoch
            lr = lr_schedule(step, total, peak_lr)

            base_loss = 0.35 + 3.8 * math.exp(-step / (total * 0.25))
            loss = ar1(loss, base_loss, persistence=0.88, noise=0.04 * max(base_loss, 0.3))
            if random.random() < 0.0025:
                loss += random.uniform(0.4, 2.0)
            loss = max(0.05, loss)

            gn_target = 0.5 + 1.4 * math.exp(-step / (total * 0.2)) + 1.2 * max(0.0, loss - base_loss)
            grad_norm = max(0.05, ar1(grad_norm, gn_target, persistence=0.7, noise=0.18))
            grad_norm_clipped = min(grad_norm, 1.0)

            train_acc = max(0.0, min(1.0, 1 - 0.23 * loss + random.gauss(0, 0.012)))

            in_dip = step > 0 and step % 1000 < 15
            tgt_tp = 800 if in_dip else 4200
            throughput = max(50.0, ar1(throughput, tgt_tp, persistence=0.7 if in_dip else 0.9, noise=120))

            gpu_mem = ar1(gpu_mem, 38.0 + 0.6 * math.sin(step / 300), persistence=0.96, noise=0.06)

            quokka.log({
                "train/loss": loss,
                "train/accuracy": train_acc,
                "train/grad_norm": grad_norm,
                "train/grad_norm_clipped": grad_norm_clipped,
                "train/lr": lr,
                "train/epoch": epoch,
                "perf/samples_per_s": throughput,
                "perf/tokens_per_s": throughput * seq_len,
                "perf/gpu_mem_gb": gpu_mem,
            }, step=step)

            val_every = max(50, steps_per_epoch // 4)
            if step > 0 and (step % val_every == 0 or step == total - 1):
                val_loss = base_loss * (1.05 + 0.08 * random.random())
                if step > total * 0.7:
                    val_loss += 0.14 * (step / total - 0.7) * random.uniform(0.5, 2.5)
                val_acc = max(0.0, min(1.0, 1 - 0.25 * val_loss + random.gauss(0, 0.008)))
                quokka.log({"val/loss": val_loss, "val/accuracy": val_acc}, step=step)

            sample_every = max(400, steps_per_epoch // 3)
            if step - last_sample >= sample_every or step == total - 1:
                gt, pred = random.choice(SAMPLES)
                quokka.log({"eval/sample": quokka.Sample(gt=gt, pred=pred)}, step=step)
                last_sample = step

            if step % 500 == 0 and step > 0:
                print(f"  step {step:>5} epoch={epoch:.2f} loss={loss:.3f} lr={lr:.2e} gn={grad_norm:.2f}")

            time.sleep(interval)
    finally:
        quokka.finish()

    print("Done.")


if __name__ == "__main__":
    main()
