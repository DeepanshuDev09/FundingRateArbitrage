import { computeSpreads, type FundingRate } from "@/lib/core";
import { getDeltaRates, getCoinSwitchRates } from "@/lib/exchanges";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 20;

// Scans both exchanges and returns the 5 coins with the biggest funding difference.
export async function GET() {
  const [d, c] = await Promise.allSettled([getDeltaRates(), getCoinSwitchRates()]);
  const st = (r: PromiseSettledResult<FundingRate[]>) => r.status === "fulfilled" ? { ok: true, count: r.value.length } : { ok: false, error: String(r.reason?.message ?? r.reason) };
  const min = Number(process.env.MIN_VOLUME_USDT ?? 100000);
  const thin = (f: FundingRate) => f.volumeUsd !== null && f.volumeUsd < min; // unknown volume is not excluded
  const top = d.status === "fulfilled" && c.status === "fulfilled" ? computeSpreads(d.value, c.value).filter((s) => !thin(s.a) && !thin(s.b)).slice(0, 5) : [];
  return Response.json({ updatedAt: Date.now(), status: { delta: st(d), coinswitch: st(c) }, top });
}
