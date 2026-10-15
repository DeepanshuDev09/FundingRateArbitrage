import { timingSafeEqual } from "crypto";
import { computeSpreads, type FundingRate } from "@/lib/core";
import { getDeltaRates, getCoinSwitchRates } from "@/lib/exchanges";
import { ensureSchema, sql } from "@/lib/db";
import { cfgFromEnv, evaluate, type NewAlert, type State } from "@/lib/alerts";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 30;

export async function GET(req: Request) {
  const got = Buffer.from(req.headers.get("authorization") ?? ""); const want = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(got, want)) return new Response("Unauthorized", { status: 401 });
  const t0 = Date.now(); await ensureSchema(); const q = sql();
  const res: Record<string, PromiseSettledResult<FundingRate[]>> = {};
  [res.delta, res.coinswitch] = await Promise.allSettled([getDeltaRates(), getCoinSwitchRates()]);
  const alerts: NewAlert[] = []; const maxFail = Number(process.env.OUTAGE_AFTER_FAILURES ?? 3);
  for (const [ex, r] of Object.entries(res)) { // exchange health + one outage / one recovery alert
    const ok = r.status === "fulfilled"; const msg = ok ? null : String((r as PromiseRejectedResult).reason?.message ?? "error");
    const [h] = await q`INSERT INTO exchange_health(exchange,consecutive_failures,last_success_at,last_error) VALUES (${ex},${ok ? 0 : 1},${ok ? new Date() : null},${msg})
      ON CONFLICT (exchange) DO UPDATE SET consecutive_failures = CASE WHEN ${ok}::boolean THEN 0 ELSE exchange_health.consecutive_failures + 1 END,
      last_success_at = CASE WHEN ${ok}::boolean THEN now() ELSE exchange_health.last_success_at END, last_error = ${msg}
      RETURNING consecutive_failures, outage_alerted`;
    if (!ok && h.consecutive_failures >= maxFail && !h.outage_alerted) { alerts.push({ type: "outage", message: `${ex} failed ${h.consecutive_failures} checks in a row: ${msg}` }); await q`UPDATE exchange_health SET outage_alerted=true WHERE exchange=${ex}`; }
    if (ok && h.outage_alerted) { alerts.push({ type: "recovery", message: `${ex} is back` }); await q`UPDATE exchange_health SET outage_alerted=false WHERE exchange=${ex}`; }
  }
  let matched = 0;
  if (res.delta.status === "fulfilled" && res.coinswitch.status === "fulfilled") { // never compare against a failed side
    const spreads = computeSpreads(res.delta.value, res.coinswitch.value); matched = spreads.length;
    const rows = spreads.map((s) => ({ base_asset: s.baseAsset, delta_rate: s.a.rate, cs_rate: s.b.rate, hourly_spread: s.hourlySpread, annualized_spread: s.annualizedSpread, long_on: s.longOn, short_on: s.shortOn }));
    if (rows.length) await q.query(`INSERT INTO spread_snapshots(base_asset,delta_rate,cs_rate,hourly_spread,annualized_spread,long_on,short_on)
      SELECT * FROM json_to_recordset($1::json) AS x(base_asset text,delta_rate float8,cs_rate float8,hourly_spread float8,annualized_spread float8,long_on text,short_on text)`, [JSON.stringify(rows)]);
    const st = new Map<string, State>((await q`SELECT base_asset, active, last_alert_at, last_spread FROM alert_state`).map((r) => [r.base_asset, { active: r.active, lastAlertAt: +new Date(r.last_alert_at ?? 0), lastSpread: r.last_spread }]));
    const out = evaluate(spreads, st, cfgFromEnv(), Date.now()); alerts.push(...out.alerts);
    for (const [b, s] of out.next) await q`INSERT INTO alert_state(base_asset,active,last_alert_at,last_spread) VALUES (${b},${s.active},${new Date(s.lastAlertAt)},${s.lastSpread})
      ON CONFLICT (base_asset) DO UPDATE SET active=${s.active}, last_alert_at=${new Date(s.lastAlertAt)}, last_spread=${s.lastSpread}`;
  }
  for (const a of alerts) await q`INSERT INTO alerts(type,base_asset,message) VALUES (${a.type},${a.base ?? null},${a.message})`;
  if (new Date().getMinutes() < 5) { const d = Number(process.env.RETENTION_DAYS ?? 30); await q`DELETE FROM spread_snapshots WHERE captured_at < now() - make_interval(days => ${d})`; await q`DELETE FROM alerts WHERE created_at < now() - make_interval(days => ${d})`; }
  return Response.json({ delta: res.delta.status, coinswitch: res.coinswitch.status, matched, alerts: alerts.length, ms: Date.now() - t0 });
}
