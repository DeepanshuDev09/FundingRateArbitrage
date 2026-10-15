import { describe, expect, it } from "vitest";
import { parseCoinSwitchPayload } from "@/lib/exchanges/coinswitch";
import { parseDeltaResponses } from "@/lib/exchanges/delta";

describe("exchange response parsers", () => {
  it("parses Delta public product and ticker fields", () => {
    const products = {
      success: true,
      result: [{
        symbol: "BTCUSD",
        contract_type: "perpetual_futures",
        state: "live",
        underlying_asset: { symbol: "BTC" },
        product_specs: { rate_exchange_interval: 28800 },
      }],
    };
    const tickers = {
      success: true,
      result: [{
        symbol: "BTCUSD",
        contract_type: "perpetual_futures",
        funding_rate: "0.001",
        timestamp: 1792022400000000,
      }],
    };
    const [rate] = parseDeltaResponses(products, tickers);
    expect(rate.baseAsset).toBe("BTC");
    expect(rate.intervalHours).toBe(8);
    expect(rate.rate).toBe(0.001);
    expect(rate.nextFundingTime).toBeNull();
  });

  it("parses the documented CoinSwitch NATS ticker envelope", () => {
    const response = JSON.stringify({
      t: 0,
      e: "COINSWITCHX",
      Epoch: 1756476914647,
      ticker_data: [{
        t: 1756476541682,
        m: "BTC/USDT",
        E: 1756476914647,
        T: 1756483200000,
        p: 108719,
        i: 108754.05,
        r: 1.773e-05,
        oi: "67075.848",
        oiv: "7292419118.71",
      }],
    });
    const [rate] = parseCoinSwitchPayload(response);
    expect(rate.symbol).toBe("BTC/USDT");
    expect(rate.rate).toBe(1.773e-05);
    expect(rate.nextFundingTime).toBe(new Date(1756483200000).toISOString());
  });

  it("fails clearly when the Delta ticker shape changes", () => {
    expect(() => parseDeltaResponses(
      { success: true, result: [] },
      { success: true, result: [{ symbol: "BTCUSD" }] },
    )).toThrow(/funding_rate/);
  });

  it("fails clearly when the CoinSwitch ticker shape changes", () => {
    expect(() => parseCoinSwitchPayload('{"ticker_data":[{"m":"BTC/USDT","r":"unknown"}]}'))
      .toThrow();
  });
});
