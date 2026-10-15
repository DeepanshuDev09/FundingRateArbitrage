import { neon } from "@neondatabase/serverless";
export const sql = () => neon(process.env.DATABASE_URL!);
let ready: Promise<void> | null = null;
export function ensureSchema() {
  return (ready ??= (async () => {
    const q = sql();
    await q`CREATE TABLE IF NOT EXISTS spread_snapshots(captured_at timestamptz NOT NULL DEFAULT now(), base_asset text NOT NULL, delta_rate double precision, cs_rate double precision, hourly_spread double precision, annualized_spread double precision, long_on text, short_on text)`;
    await q`CREATE INDEX IF NOT EXISTS snap_idx ON spread_snapshots(base_asset, captured_at)`;
    await q`CREATE TABLE IF NOT EXISTS alerts(id serial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), type text NOT NULL, base_asset text, message text NOT NULL, read boolean NOT NULL DEFAULT false)`;
    await q`CREATE TABLE IF NOT EXISTS alert_state(base_asset text PRIMARY KEY, active boolean NOT NULL, last_alert_at timestamptz, last_spread double precision)`;
    await q`CREATE TABLE IF NOT EXISTS exchange_health(exchange text PRIMARY KEY, consecutive_failures int NOT NULL DEFAULT 0, last_success_at timestamptz, last_error text, outage_alerted boolean NOT NULL DEFAULT false)`;
  })());
}
