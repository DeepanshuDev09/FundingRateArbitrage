import type { FundingRate } from "@/lib/models";

export interface ExchangeAdapter {
  readonly name: FundingRate["exchange"];
  getFundingRates(): Promise<FundingRate[]>;
}
