-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Metric hypertable: raw time-series data, never mutated after write
CREATE TABLE IF NOT EXISTS metric (
  run_id     UUID             NOT NULL,
  key        TEXT             NOT NULL,
  step       BIGINT           NOT NULL,
  value      DOUBLE PRECISION NOT NULL,
  wall_time  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('metric', 'wall_time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_metric_run_key_step
  ON metric (run_id, key, step);
