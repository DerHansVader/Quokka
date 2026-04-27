# Upgrade scripts

Non-destructive upgrade of a self-hosted Quokka deployment. Each step is a small
script you can run on its own; `upgrade.sh` runs them in order.

```
deploy/upgrade/
├── upgrade.sh        # main orchestrator
├── lib.sh            # shared helpers (sourced, never run directly)
├── steps/
│   ├── preflight.sh  # checks docker, git, deploy/.env
│   ├── backup.sh     # pg_dump → backups/upgrade_<ts>.sql.gz
│   ├── pull.sh       # git pull --ff-only (stashes local changes)
│   ├── rebuild.sh    # docker compose build + up -d --no-deps api web
│   └── verify.sh     # waits for /api/health + asserts metric hypertable
└── tests/            # bash test suite, runs offline with mocked binaries
```

## Run an upgrade

From the repo root, with the stack already running:

```bash
./deploy/upgrade/upgrade.sh
```

## Useful flags

| Variable                | Effect                                              |
| ----------------------- | --------------------------------------------------- |
| `DRY_RUN=1`             | Print every command instead of running it          |
| `SKIP_PULL=1`           | Don't `git pull` (use the code already checked out) |
| `BACKUP_DIR=/some/path` | Where the pre-upgrade dump goes (default `./backups`) |
| `WAIT_SECONDS=120`      | How long `verify` waits for the api to come up      |

## Why it is safe

- **Backup first.** `backup.sh` writes a gzipped `pg_dump` to the host before
  anything else; the orchestrator refuses to continue if that fails.
- **Postgres is never restarted or rebuilt.** `rebuild.sh` uses
  `--no-deps api web`, so the database container, its volume, and its open
  connections survive every upgrade.
- **Migrations apply via `prisma migrate deploy`.** Run automatically by the
  api container's entrypoint. `prisma db push` is blocked at the npm-script
  level — see the project README for why.
- **Loud verification.** `verify.sh` waits for `/api/health` and confirms the
  `metric` hypertable still exists. If it doesn't, the script aborts loudly so
  the operator restores from the backup written minutes earlier.

## Run the tests

```bash
./deploy/upgrade/tests/run.sh
```

The suite mocks `docker`, `git`, `gzip`, and `du` via a temporary `PATH`, so
it doesn't need a running deployment. It covers:

- `lib.sh` helpers (`detect_compose`, `run`, `load_env`, `require_command`)
- preflight: tool check, env validation, dirty tree warning
- backup: real run, dry run, refusal when postgres is down
- pull: clean tree, dirty tree (auto-stash)
- rebuild: build + roll, dry run
- verify: healthy api, unhealthy api, missing metric hypertable
- upgrade orchestrator: happy path, preflight failure, verify failure,
  `SKIP_PULL=1`
