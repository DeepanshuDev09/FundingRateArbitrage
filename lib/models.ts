export type ExchangeName = "Delta Exchange India" | "CoinSwitch";

export interface FundingRate {
  exchange: ExchangeName;
  symbol: string;
  baseAsset: string;
  rate: number;
  intervalHours: number;
  nextFundingTime: string | null;
  timestamp: string;
}

export interface ExchangeStatus {
  status: "ok" | "error";
  message: string;
  updatedAt: string | null;
}

export interface FundingSpread {
  coin: string;
  deltaRate: number;
  coinSwitchRate: number;
  deltaIntervalHours: number;
  coinSwitchIntervalHours: number;
  rawSpread: number;
  normalizedHourlySpread: number;
  annualizedSpread: number;
  direction: "long-delta-short-coinswitch" | "long-coinswitch-short-delta" | null;
  deltaNextFundingTime: string | null;
  coinSwitchNextFundingTime: string | null;
}

export interface RatesSnapshot {
  exchanges: {
    delta: ExchangeStatus;
    coinSwitch: ExchangeStatus;
  };
  spreads: FundingSpread[];
  updatedAt: string | null;
}
