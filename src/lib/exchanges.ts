import { z } from "zod";
import { connect } from "nats.ws";
import type { FundingRate } from "./core";
const Ticker = z.object({
  symbol: z.string(), contract_type: z.string().optional(),
  underlying_asset_symbol: z.string().optional(),
  funding_rate: z.coerce.number().nullable().optional(),
  turnover_usd: z.coerce.number().nullable().optional(),
});
const Resp = z.object({ success: z.boolean(), result: z.array(z.unknown()) });

export async function getDeltaRates(): Promise<FundingRate[]> {
  const res = await fetch("https://api.india.delta.exchange/v2/tickers?contract_types=perpetual_futures",
    { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`Delta HTTP ${res.status}`);
  const body = Resp.parse(await res.json());
  const pct = process.env.DELTA_RATE_IN_PERCENT !== "false";
  const hrs = Number(process.env.DELTA_INTERVAL_HOURS ?? 8);
  const out: FundingRate[] = [];
  for (const raw of body.result) {
    const t = Ticker.safeParse(raw);
    if (!t.success || t.data.funding_rate == null) continue;
    const base = (t.data.underlying_asset_symbol ?? t.data.symbol.replace(/USDT?$/, "")).toUpperCase();
    out.push({ exchange: "delta", symbol: t.data.symbol, baseAsset: base,
      rate: pct ? t.data.funding_rate / 100 : t.data.funding_rate, intervalHours: hrs,
      nextFundingTime: null, volumeUsd: t.data.turnover_usd ?? null });
  }
  return out;
}
// Public NATS ticker stream (no auth). Connect, collect a snapshot, close.
interface T { m?: string; r?: number; T?: number; qv?: string }
export async function getCoinSwitchRates(): Promise<FundingRate[]> {
  const nc = await connect({ servers: "wss://pc-nats-prod.coinswitch.co", timeout: 5000 });
  const seen = new Map<string, T>();
  const sub = nc.subscribe("v1.f.ex1.public.futures.ticker.>");
  const ms = Number(process.env.CS_SNAPSHOT_MS ?? 3500);
  const timer = setTimeout(() => sub.unsubscribe(), ms);
  try {
    for await (const msg of sub) {
      let data: unknown; try { data = JSON.parse(new TextDecoder().decode(msg.data)); } catch { continue; }
      for (const env of Array.isArray(data) ? data : [data])
        for (const t of ((env as { ticker_data?: T[] }).ticker_data ?? []))
          if (t.m && typeof t.r === "number") seen.set(t.m, t);
    }
  } finally { clearTimeout(timer); await nc.close().catch(() => {}); }
  if (seen.size === 0) throw new Error("CoinSwitch: no ticker data received");
  const pct = process.env.CS_RATE_IN_PERCENT === "true";
  const hrs = Number(process.env.CS_INTERVAL_HOURS ?? 8);
  return [...seen.values()].map((t) => ({
    exchange: "coinswitch" as const, symbol: t.m!, baseAsset: t.m!.split("/")[0].toUpperCase(),
    rate: pct ? t.r! / 100 : t.r!, intervalHours: hrs, nextFundingTime: t.T ?? null,
    volumeUsd: t.qv ? Number(t.qv) : null }));
}
