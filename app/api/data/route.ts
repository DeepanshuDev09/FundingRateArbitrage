import { computeSpreads, type FundingRate } from "@/lib/core";
import { getDeltaRates, getCoinSwitchRates } from "@/lib/exchanges";
import { ensureSchema, sql } from "@/lib/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 20;

// One endpoint for the whole dashboard. GET = live rates + alerts. GET ?history=1&coin=BTC&hours=24 = chart data. POST = mark alerts read.
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("history")) {
    const coin = (u.searchParams.get("coin") ?? "").toUpperCase().slice(0, 20); const hours = Math.min(Number(u.searchParams.get("hours")) || 24, 720);
    await ensureSchema();
    const rows = await sql()`SELECT extract(epoch FROM captured_at)*1000 AS t, hourly_spread AS h FROM spread_snapshots WHERE base_asset=${coin} AND captured_at > now() - make_interval(hours => ${hours}) ORDER BY captured_at`;
    return Response.json(rows.map((r) => ({ t: Number(r.t), h: r.h })));
  }
  const [d, c] = await Promise.allSettled([getDeltaRates(), getCoinSwitchRates()]);
  const st = (r: PromiseSettledResult<FundingRate[]>) => r.status === "fulfilled" ? { ok: true, count: r.value.length } : { ok: false, error: String(r.reason?.message ?? r.reason) };
  const spreads = d.status === "fulfilled" && c.status === "fulfilled" ? computeSpreads(d.value, c.value) : [];
  let db: { alerts: unknown[]; unread: number; health: unknown[]; error?: string } = { alerts: [], unread: 0, health: [] };
  try {
    await ensureSchema(); const q = sql();
    const [alerts, [n], health] = await Promise.all([q`SELECT id, created_at, type, message, read FROM alerts ORDER BY id DESC LIMIT 50`, q`SELECT count(*)::int AS n FROM alerts WHERE NOT read`, q`SELECT exchange, last_success_at FROM exchange_health`]);
    db = { alerts, unread: n.n, health };
  } catch (e) { db.error = "Database not connected. Set DATABASE_URL to enable history and alerts."; }
  return Response.json({ updatedAt: Date.now(), status: { delta: st(d), coinswitch: st(c) }, spreads, ...db });
}
export async function POST() { await ensureSchema(); await sql()`UPDATE alerts SET read=true WHERE NOT read`; return Response.json({ ok: true }); }
