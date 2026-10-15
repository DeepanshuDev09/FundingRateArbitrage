import { unstable_cache } from "next/cache";
import type { ExchangeStatus, FundingRate, RatesSnapshot } from "@/lib/models";
import { errorMessage } from "@/lib/http";
import { calculateSpreads } from "@/lib/spread";
import { coinSwitchAdapter } from "@/lib/exchanges/coinswitch";
import { deltaAdapter } from "@/lib/exchanges/delta";

const cachedDeltaRates = unstable_cache(
  () => deltaAdapter.getFundingRates(),
  ["delta-funding-rates-v1"],
  { revalidate: 30 },
);
const cachedCoinSwitchRates = unstable_cache(
  () => coinSwitchAdapter.getFundingRates(),
  ["coinswitch-funding-rates-v1"],
  { revalidate: 30 },
);

function latestTimestamp(rates: FundingRate[]): string | null {
  return rates.reduce<string | null>(
    (latest, rate) => !latest || rate.timestamp > latest ? rate.timestamp : latest,
    null,
  );
}

async function settleExchange(
  fetchRates: () => Promise<FundingRate[]>,
  assumptions: string,
): Promise<{ rates: FundingRate[]; status: ExchangeStatus }> {
  try {
    const rates = await fetchRates();
    if (rates.length === 0) {
      throw new Error("The public feed returned no live perpetual funding rates.");
    }
    return {
      rates,
      status: {
        status: "ok",
        message: assumptions,
        updatedAt: latestTimestamp(rates),
      },
    };
  } catch (error) {
    return {
      rates: [],
      status: {
        status: "error",
        message: errorMessage(error),
        updatedAt: null,
      },
    };
  }
}

export async function getRatesSnapshot(forceRefresh = false): Promise<RatesSnapshot> {
  const deltaFetcher = forceRefresh ? () => deltaAdapter.getFundingRates() : cachedDeltaRates;
  const coinSwitchFetcher = forceRefresh
    ? () => coinSwitchAdapter.getFundingRates()
    : cachedCoinSwitchRates;

  const [delta, coinSwitch] = await Promise.all([
    settleExchange(
      deltaFetcher,
      "Funding-rate units and payer sign are not specified in the cited ticker schema; next funding time is not exposed by the ticker.",
    ),
    settleExchange(
      coinSwitchFetcher,
      "Provisional: rate treated as a decimal fraction and interval assumed 8h from the sample funding-time boundary; verify both against official product terms.",
    ),
  ]);

  const updatedAt = [delta.status.updatedAt, coinSwitch.status.updatedAt]
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;

  return {
    exchanges: {
      delta: delta.status,
      coinSwitch: coinSwitch.status,
    },
    spreads: calculateSpreads(delta.rates, coinSwitch.rates),
    updatedAt,
  };
}
