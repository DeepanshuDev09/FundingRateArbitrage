import { describe, expect, it } from "vitest";
import type { FundingRate } from "@/lib/models";
import { calculateSpreads } from "@/lib/spread";

const deltaRate = (symbol: string, rate: number): FundingRate => ({
  exchange: "Delta Exchange India",
  symbol,
  baseAsset: symbol.replace(/USD$/, ""),
  rate,
  intervalHours: 8,
  nextFundingTime: null,
  timestamp: "2026-10-15T00:00:00.000Z",
});

const coinSwitchRate = (symbol: string, rate: number): FundingRate => ({
  exchange: "CoinSwitch",
  symbol: `${symbol}/USDT`,
  baseAsset: symbol,
  rate,
  intervalHours: 8,
  nextFundingTime: "2026-10-15T08:00:00.000Z",
  timestamp: "2026-10-15T00:00:00.000Z",
});

describe("calculateSpreads", () => {
  it("matches only assets available on both exchanges", () => {
    const spreads = calculateSpreads(
      [deltaRate("BTCUSD", -0.01), deltaRate("ETHUSD", 0.002)],
      [coinSwitchRate("BTC", -0.02)],
    );
    expect(spreads.map((spread) => spread.coin)).toEqual(["BTC"]);
  });

  it("longs the exchange with more-negative funding and shorts the other", () => {
    const [spread] = calculateSpreads(
      [deltaRate("BTCUSD", -0.01)],
      [coinSwitchRate("BTC", -0.02)],
    );
    expect(spread.direction).toBe("long-coinswitch-short-delta");
    expect(spread.rawSpread).toBeCloseTo(0.01);
  });

  it("reverses the direction when Delta has the lower funding rate", () => {
    const [spread] = calculateSpreads(
      [deltaRate("BTCUSD", -0.03)],
      [coinSwitchRate("BTC", 0.01)],
    );
    expect(spread.direction).toBe("long-delta-short-coinswitch");
  });

  it("normalizes intervals independently before computing the spread", () => {
    const delta = { ...deltaRate("BTCUSD", 0.008), intervalHours: 8 };
    const coinSwitch = { ...coinSwitchRate("BTC", 0.004), intervalHours: 4 };
    const [spread] = calculateSpreads([delta], [coinSwitch]);
    expect(spread.normalizedHourlySpread).toBeCloseTo(0);
    expect(spread.annualizedSpread).toBeCloseTo(0);
  });

  it("returns no rows if there are no common symbols", () => {
    expect(calculateSpreads([deltaRate("BTCUSD", 0.01)], [coinSwitchRate("ETH", 0.02)])).toEqual([]);
  });
});
