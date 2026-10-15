export type Exchange = "delta" | "coinswitch";
export interface FundingRate {
  exchange: Exchange; symbol: string; baseAsset: string;
  rate: number;            // fraction per funding interval (0.01 = 1%)
  intervalHours: number; nextFundingTime: number | null; volumeUsd: number | null;
}
export interface Spread {
  baseAsset: string; a: FundingRate; b: FundingRate;
  longOn: Exchange; shortOn: Exchange;
  hourlySpread: number; annualizedSpread: number; perIntervalSpread: number;
}
export const hourly = (r: FundingRate) => r.rate / r.intervalHours;
export const annualize = (hourlyRate: number) => hourlyRate * 24 * 365;

/** Positive funding: longs pay shorts. So LONG where funding is lowest, SHORT where it is highest.
 *  Gain per hour = hourly(short leg) - hourly(long leg).
 *  Example: Delta -1%, CoinSwitch -2% -> long CoinSwitch (receive 2%), short Delta (pay 1%) -> +1%. */
export function computeSpreads(delta: FundingRate[], cs: FundingRate[]): Spread[] {
  const csMap = new Map(cs.map((r) => [r.baseAsset, r]));
  const out: Spread[] = [];
  for (const a of delta) {
    const b = csMap.get(a.baseAsset);
    if (!b) continue; // only coins on BOTH exchanges
    const [short, long] = hourly(a) >= hourly(b) ? [a, b] : [b, a];
    const h = hourly(short) - hourly(long);
    out.push({ baseAsset: a.baseAsset, a, b, longOn: long.exchange, shortOn: short.exchange,
      hourlySpread: h, annualizedSpread: annualize(h), perIntervalSpread: h * 8 });
  }
  return out.sort((x, y) => y.hourlySpread - x.hourlySpread);
}
