import type { FundingRate, FundingSpread } from "@/lib/models";
import { normalizeRate } from "@/lib/normalize";
import { normalizeBaseAsset } from "@/lib/symbols";

export function calculateSpreads(
  deltaRates: FundingRate[],
  coinSwitchRates: FundingRate[],
): FundingSpread[] {
  const coinSwitchByBase = new Map(
    coinSwitchRates.map((rate) => [normalizeBaseAsset(rate.baseAsset), rate]),
  );

  return deltaRates.flatMap((deltaRate) => {
    const coin = normalizeBaseAsset(deltaRate.baseAsset);
    const coinSwitchRate = coinSwitchByBase.get(coin);
    if (!coinSwitchRate) return [];

    const deltaHourly = normalizeRate(deltaRate.rate, deltaRate.intervalHours).hourlyRate;
    const coinSwitchHourly = normalizeRate(
      coinSwitchRate.rate,
      coinSwitchRate.intervalHours,
    ).hourlyRate;
    const normalizedHourlySpread = deltaHourly - coinSwitchHourly;

    return [{
      coin,
      deltaRate: deltaRate.rate,
      coinSwitchRate: coinSwitchRate.rate,
      deltaIntervalHours: deltaRate.intervalHours,
      coinSwitchIntervalHours: coinSwitchRate.intervalHours,
      rawSpread: deltaRate.rate - coinSwitchRate.rate,
      normalizedHourlySpread,
      annualizedSpread: normalizedHourlySpread * 24 * 365,
      direction:
        deltaHourly < coinSwitchHourly
          ? "long-delta-short-coinswitch"
          : deltaHourly > coinSwitchHourly
            ? "long-coinswitch-short-delta"
            : null,
      deltaNextFundingTime: deltaRate.nextFundingTime,
      coinSwitchNextFundingTime: coinSwitchRate.nextFundingTime,
    }];
  }).sort((a, b) => Math.abs(b.annualizedSpread) - Math.abs(a.annualizedSpread));
}
