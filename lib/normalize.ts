export const HOURS_PER_YEAR = 24 * 365;

export interface NormalizedRate {
  hourlyRate: number;
  annualizedRate: number;
}

export function normalizeRate(rate: number, intervalHours: number): NormalizedRate {
  if (!Number.isFinite(rate)) {
    throw new Error("Funding rate must be a finite number.");
  }
  if (!Number.isFinite(intervalHours) || intervalHours <= 0) {
    throw new Error("Funding interval must be a positive, finite number of hours.");
  }

  const hourlyRate = rate / intervalHours;
  return {
    hourlyRate,
    annualizedRate: hourlyRate * HOURS_PER_YEAR,
  };
}
