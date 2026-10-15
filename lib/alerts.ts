import type { Spread } from "./core";
export interface Cfg { minNetApr: number; feePct: number; holdHours: number; minVolume: number; cooldownMin: number; growPct: number }
export interface State { active: boolean; lastAlertAt: number; lastSpread: number }
export interface NewAlert { type: "opportunity" | "closed" | "outage" | "recovery"; base?: string; message: string }
const n = (k: string, d: number) => Number(process.env[k] ?? d);
export const cfgFromEnv = (): Cfg => ({ minNetApr: n("ALERT_MIN_NET_APR_PCT", 30), feePct: n("FEE_ROUND_TRIP_PCT", 0.2), holdHours: n("ASSUMED_HOLD_HOURS", 24),
  minVolume: n("ALERT_MIN_VOLUME_USDT", 100000), cooldownMin: n("ALERT_COOLDOWN_MINUTES", 60), growPct: n("ALERT_REALERT_GROWTH_PCT", 50) });
const nm = (e: string) => (e === "delta" ? "Delta" : "CoinSwitch");
export const netApr = (s: Spread, c: Cfg) => (s.hourlySpread - c.feePct / 100 / c.holdHours) * 24 * 365 * 100;

/** Pure: decides which alerts to raise. Hysteresis: after an alert the pair stays "active" until it drops below the threshold (then one "closed" alert). */
export function evaluate(spreads: Spread[], state: Map<string, State>, c: Cfg, now: number) {
  const alerts: NewAlert[] = []; const next = new Map<string, State>();
  for (const s of spreads) {
    const vols = [s.a.volumeUsd, s.b.volumeUsd]; // unknown volume is skipped, not trusted
    const liquid = vols.every((v) => v != null && v >= c.minVolume);
    const apr = netApr(s, c); const ok = liquid && apr >= c.minNetApr; const st = state.get(s.baseAsset);
    const text = `${s.baseAsset} | Long ${nm(s.longOn)}, Short ${nm(s.shortOn)} | Delta ${(s.a.rate * 100).toFixed(3)}%/${s.a.intervalHours}h, CoinSwitch ${(s.b.rate * 100).toFixed(3)}%/${s.b.intervalHours}h | Net ${apr.toFixed(0)}% APR after est. fees`;
    if (ok && !st?.active) { alerts.push({ type: "opportunity", base: s.baseAsset, message: text }); next.set(s.baseAsset, { active: true, lastAlertAt: now, lastSpread: s.hourlySpread }); }
    else if (ok && st) {
      const grew = s.hourlySpread >= st.lastSpread * (1 + c.growPct / 100);
      if (grew && now - st.lastAlertAt >= c.cooldownMin * 60000) { alerts.push({ type: "opportunity", base: s.baseAsset, message: `${text} (spread grew)` }); next.set(s.baseAsset, { active: true, lastAlertAt: now, lastSpread: s.hourlySpread }); }
    } else if (!ok && st?.active) { alerts.push({ type: "closed", base: s.baseAsset, message: `${s.baseAsset} spread closed (net ${apr.toFixed(0)}% APR)` }); next.set(s.baseAsset, { ...st, active: false }); }
  }
  return { alerts, next };
}
