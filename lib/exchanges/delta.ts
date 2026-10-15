import { z } from "zod";
import type { FundingRate } from "@/lib/models";
import { fetchJson } from "@/lib/http";
import { normalizeBaseAsset } from "@/lib/symbols";
import type { ExchangeAdapter } from "@/lib/exchanges/types";

const productSchema = z.object({
  symbol: z.string().min(1),
  contract_type: z.string(),
  state: z.string(),
  underlying_asset: z.object({ symbol: z.string().min(1) }),
  product_specs: z.object({
    rate_exchange_interval: z.union([z.number(), z.string()]).optional(),
  }).passthrough().optional(),
}).passthrough();

const productsResponseSchema = z.object({
  success: z.literal(true),
  result: z.array(productSchema),
}).passthrough();

const tickerSchema = z.object({
  symbol: z.string().min(1),
  contract_type: z.string(),
  funding_rate: z.union([z.string(), z.number()]),
  timestamp: z.number().finite(),
  underlying_asset_symbol: z.string().optional(),
}).passthrough();

const tickersResponseSchema = z.object({
  success: z.literal(true),
  result: z.array(tickerSchema),
}).passthrough();

export function parseDeltaResponses(
  productsInput: unknown,
  tickersInput: unknown,
  timestampNow = Date.now(),
): FundingRate[] {
  const products = productsResponseSchema.parse(productsInput).result;
  const tickers = tickersResponseSchema.parse(tickersInput).result;
  const productBySymbol = new Map(
    products
      .filter((product) => product.contract_type === "perpetual_futures" && product.state === "live")
      .map((product) => [product.symbol, product]),
  );

  return tickers.flatMap((ticker) => {
    if (ticker.contract_type !== "perpetual_futures") return [];
    const product = productBySymbol.get(ticker.symbol);
    if (!product) return [];

    const intervalSeconds = Number(product.product_specs?.rate_exchange_interval);
    if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
      throw new Error(`Delta product ${ticker.symbol} has no valid rate_exchange_interval.`);
    }
    const rate = Number(ticker.funding_rate);
    if (!Number.isFinite(rate)) {
      throw new Error(`Delta ticker ${ticker.symbol} has a non-numeric funding_rate.`);
    }
    const baseAsset = normalizeBaseAsset(
      ticker.underlying_asset_symbol ?? product.underlying_asset.symbol,
    );

    return [{
      exchange: "Delta Exchange India",
      symbol: ticker.symbol,
      baseAsset,
      rate,
      intervalHours: intervalSeconds / 3600,
      nextFundingTime: null,
      timestamp: new Date(Math.floor(ticker.timestamp / 1000)).toISOString(),
    }];
  });
}

export const deltaAdapter: ExchangeAdapter = {
  name: "Delta Exchange India",
  async getFundingRates() {
    const baseUrl = (process.env.DELTA_API_BASE_URL ?? "https://api.india.delta.exchange").replace(/\/$/, "");
    const [products, tickers] = await Promise.all([
      fetchJson(
        `${baseUrl}/v2/products?contract_types=perpetual_futures&states=live`,
        productsResponseSchema,
        "Delta products",
      ),
      fetchJson(`${baseUrl}/v2/tickers`, tickersResponseSchema, "Delta tickers"),
    ]);
    return parseDeltaResponses(products, tickers);
  },
};
