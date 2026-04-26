# Quokka

A self-hosted experiment tracker for AI training runs. The essence of wandb, nothing more.

One process, one team, your data on your disk. Live charts, generation samples, and a tiny Python SDK that drops into existing training scripts as a one-line import swap.

---

## Features

- **Teams, projects, runs.** Multi-tenant from the start, but you only need one team for personal use.
- **Fast charts** with uPlot. Per-panel **smoothing** (EMA, DEMA, Gaussian, Moving Average, Median, Savitzky–Golay), **outlier exclusion**, **log/linear axes**, and **y-domain** overrides. Smoothing is edge-honest (no reflection padding, no mean collapse). Log scale is render-only — stored values are never mutated.
- **Live tail** via Server-Sent Events. Charts update as points arrive — no polling, no refresh.
- **Generation samples.** Side-by-side ground-truth vs. prediction, scrubbable across steps, image included.
- **Run comparison.** Multi-select runs in a project and overlay them on shared panels.
- **Persistent panel layouts.** Smoothing, axis scale, y-domain, outlier exclusion are stored server-side per scope and survive refreshes.
- **Tiny Python SDK** with a wandb-shaped API (`init`, `log`, `Sample`). Background queue thread, offline spool, no surprises.
- **Durable.** Postgres + TimescaleDB hypertable for metrics, nightly `pg_dump` backup container, persistent volumes.
- **Public docs page** for new teammates without an account.

## Architecture

| Layer    | Stack                                                         |
| -------- | ------------------------------------------------------------- |
| Backend  | NestJS · Prisma · Postgres + TimescaleDB                      |
| Frontend | React 19 · Vite · TanStack Query · uPlot · custom CSS modules |
| SDK      | Python 3.10+, single file, background queue, offline spool    |
| Ops      | Docker Compose, Caddy for TLS, `pg_dump` backups              |

```
apps/
  api/              NestJS backend
  web/              React frontend
packages/
  shared/           Shared TS types
  sdk-python/       Python SDK
deploy/             docker-compose, Caddy, backup
examples/           Training-run simulators for demos
```

## Self-host

You need a host with Docker and a domain pointing at it.

```bash
git clone https://github.com/quokka-ml/quokka.git
cd quokka/deploy
cp .env.example .env
# edit .env — set DOMAIN, POSTGRES_PASSWORD, JWT_SECRET
docker compose up -d
```

Caddy provisions TLS automatically. The first signup becomes the owner of the default team; everyone else joins via invite links from the team admin page.

## Local development

Requires **Node 20+**, **pnpm**, **Docker**, and **Python 3.10+** (only for the SDK).

```bash
pnpm install
docker compose -f deploy/docker-compose.dev.yml up -d
pnpm --filter @quokka/api db:migrate
pnpm dev
```

- API on [http://localhost:4000](http://localhost:4000)
- Web on [http://localhost:3000](http://localhost:3000)

```bash
pnpm test            # vitest for the web app
pnpm build           # production build of api + web
```

## Use the SDK

```bash
pip install -e packages/sdk-python
```

```python
import quokka

quokka.login("qk_...")  # or set QK_API_KEY
quokka.init(project="<project-id>", run="coord-loss-v3", config={"lr": 3e-4})

for step in range(1000):
    quokka.log({"loss": loss, "acc": acc}, step=step)

quokka.log({"sample/val": quokka.Sample(gt=gt_text, pred=pred_text)}, step=step)
quokka.finish()
```

The SDK queues writes on a background thread and spools to disk (`~/.quokka/spool/`) if the server is unreachable, so a flaky network never stalls training.

## License

Apache 2.0. See [LICENSE](./LICENSE).
