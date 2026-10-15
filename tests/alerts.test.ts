import { describe, it, expect } from "vitest";
import { computeSpreads, type FundingRate } from "../lib/core";
import { evaluate, type State, type Cfg } from "../lib/alerts";
const fr = (exchange: "delta" | "coinswitch", rate: number, vol = 1e6): FundingRate => ({ exchange, symbol: "X", baseAsset: "BTC", rate, intervalHours: 8, nextFundingTime: null, volumeUsd: vol });
const cfg: Cfg = { minNetApr: 30, feePct: 0.2, holdHours: 24, minVolume: 1e5, cooldownMin: 60, growPct: 50 };
describe("spread", () => {
  it("Delta -1%, CoinSwitch -2% => long CoinSwitch, short Delta, +1% per 8h", () => {
    const [s] = computeSpreads([fr("delta", -0.01)], [fr("coinswitch", -0.02)]);
    expect(s.longOn).toBe("coinswitch"); expect(s.shortOn).toBe("delta"); expect(s.perIntervalSpread).toBeCloseTo(0.01);
  });
  it("skips coins missing on one exchange", () => expect(computeSpreads([fr("delta", 0.01)], [])).toHaveLength(0));
});
describe("alerts", () => {
  const sp = (d: number, c: number, vol = 1e6) => computeSpreads([fr("delta", d, vol)], [fr("coinswitch", c, vol)]);
  it("alerts once, then stays quiet (hysteresis)", () => {
    const a = evaluate(sp(-0.01, -0.02), new Map(), cfg, 0); expect(a.alerts).toHaveLength(1);
    expect(evaluate(sp(-0.01, -0.02), a.next, cfg, 1000).alerts).toHaveLength(0);
  });
  it("sends one closed alert when spread falls", () => {
    const st = new Map<string, State>([["BTC", { active: true, lastAlertAt: 0, lastSpread: 1 }]]);
    expect(evaluate(sp(0.0001, 0.0001), st, cfg, 1).alerts[0].type).toBe("closed");
  });
  it("skips illiquid coins", () => expect(evaluate(sp(-0.01, -0.02, 10), new Map(), cfg, 0).alerts).toHaveLength(0));
  it("re-alerts after cooldown only if spread grew enough", () => {
    const st = new Map<string, State>([["BTC", { active: true, lastAlertAt: 0, lastSpread: 0.0005 }]]);
    expect(evaluate(sp(-0.01, -0.02), st, cfg, 30 * 60000).alerts).toHaveLength(0);
    expect(evaluate(sp(-0.01, -0.02), st, cfg, 61 * 60000).alerts).toHaveLength(1);
  });
});
