import { describe, expect, it } from "vitest";
import { HOURS_PER_YEAR, normalizeRate } from "@/lib/normalize";

describe("normalizeRate", () => {
  it("converts an 8-hour funding rate to a per-hour rate", () => {
    expect(normalizeRate(0.008, 8).hourlyRate).toBeCloseTo(0.001);
  });

  it("preserves hourly rates for a one-hour interval", () => {
    expect(normalizeRate(0.0004, 1).hourlyRate).toBeCloseTo(0.0004);
  });

  it("normalizes a four-hour interval", () => {
    expect(normalizeRate(0.002, 4).hourlyRate).toBeCloseTo(0.0005);
  });

  it("handles negative funding rates without changing their sign", () => {
    expect(normalizeRate(-0.012, 8).hourlyRate).toBeCloseTo(-0.0015);
  });

  it("annualizes linearly over 365 days", () => {
    const rate = normalizeRate(0.008, 8);
    expect(rate.annualizedRate).toBeCloseTo(rate.hourlyRate * HOURS_PER_YEAR);
  });

  it("rejects a zero or negative interval", () => {
    expect(() => normalizeRate(0.01, 0)).toThrow(/positive/);
    expect(() => normalizeRate(0.01, -1)).toThrow(/positive/);
  });

  it("rejects non-finite rates", () => {
    expect(() => normalizeRate(Number.NaN, 8)).toThrow(/finite/);
  });
});
