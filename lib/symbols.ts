const BASE_ASSET_ALIASES: Readonly<Record<string, string>> = {
  BCC: "BCH",
  XBT: "BTC",
};

export function normalizeBaseAsset(rawBaseAsset: string): string {
  const normalized = rawBaseAsset.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,20}$/.test(normalized)) {
    throw new Error(`Unsupported base asset symbol: "${rawBaseAsset}".`);
  }
  return BASE_ASSET_ALIASES[normalized] ?? normalized;
}

export function baseAssetFromCoinSwitchMarket(market: string): string {
  const [base, quote, ...extra] = market.split("/");
  if (!base || !quote || extra.length > 0) {
    throw new Error(`Unexpected CoinSwitch market symbol: "${market}".`);
  }
  if (quote.toUpperCase() !== "USDT") {
    throw new Error(`CoinSwitch market "${market}" is not a USDT-quoted contract.`);
  }
  return normalizeBaseAsset(base);
}
