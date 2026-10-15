import { connect, StringCodec, type NatsConnection, type Subscription } from "nats";
import { z } from "zod";
import type { FundingRate } from "@/lib/models";
import { errorMessage } from "@/lib/http";
import { baseAssetFromCoinSwitchMarket } from "@/lib/symbols";
import type { ExchangeAdapter } from "@/lib/exchanges/types";

const tickerSchema = z.object({
  m: z.string().min(1),
  r: z.number().finite(),
  T: z.number().int().positive(),
  E: z.number().int().positive().optional(),
  t: z.number().int().positive().optional(),
}).passthrough();

const envelopeSchema = z.object({
  Epoch: z.number().int().positive().optional(),
  ticker_data: z.array(tickerSchema),
}).passthrough();

const payloadSchema = z.union([envelopeSchema, z.array(envelopeSchema)]);
const codec = StringCodec();
const ASSUMED_INTERVAL_HOURS = 8;

export function parseCoinSwitchPayload(payload: string): FundingRate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    throw new Error(`CoinSwitch ticker returned invalid JSON: ${errorMessage(error)}`);
  }

  const envelopes = payloadSchema.parse(parsed);
  const rows = Array.isArray(envelopes) ? envelopes : [envelopes];
  const byMarket = new Map<string, FundingRate>();

  for (const envelope of rows) {
    for (const ticker of envelope.ticker_data) {
      const updatedAtMs = ticker.E ?? ticker.t ?? envelope.Epoch ?? Date.now();
      byMarket.set(ticker.m, {
        exchange: "CoinSwitch",
        symbol: ticker.m,
        baseAsset: baseAssetFromCoinSwitchMarket(ticker.m),
        rate: ticker.r,
        intervalHours: ASSUMED_INTERVAL_HOURS,
        nextFundingTime: new Date(ticker.T).toISOString(),
        timestamp: new Date(updatedAtMs).toISOString(),
      });
    }
  }

  if (byMarket.size === 0) {
    throw new Error("CoinSwitch ticker snapshot contained no markets.");
  }
  return [...byMarket.values()];
}

async function readFirstSnapshot(subscription: Subscription): Promise<FundingRate[]> {
  for await (const message of subscription) {
    return parseCoinSwitchPayload(codec.decode(message.data));
  }
  throw new Error("CoinSwitch ticker subscription ended before a snapshot arrived.");
}

async function fetchSnapshot(): Promise<FundingRate[]> {
  const url = process.env.COINSWITCH_NATS_URL ?? "wss://pc-nats-prod.coinswitch.co";
  const subject = process.env.COINSWITCH_TICKER_SUBJECT ?? "v1.f.ex1.public.futures.ticker.>";
  const timeoutMs = Number(process.env.COINSWITCH_SNAPSHOT_TIMEOUT_MS ?? 5000);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 500 || timeoutMs > 15000) {
    throw new Error("COINSWITCH_SNAPSHOT_TIMEOUT_MS must be between 500 and 15000.");
  }

  let connection: NatsConnection | undefined;
  let subscription: Subscription | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    connection = await connect({
      servers: url,
      timeout: timeoutMs,
      maxReconnectAttempts: 0,
    });
    subscription = connection.subscribe(subject);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`CoinSwitch ticker snapshot timed out after ${timeoutMs} ms.`)),
        timeoutMs,
      );
    });
    return await Promise.race([readFirstSnapshot(subscription), timeout]);
  } catch (error) {
    throw new Error(`CoinSwitch public ticker failed: ${errorMessage(error)}`);
  } finally {
    if (timer) clearTimeout(timer);
    subscription?.unsubscribe();
    if (connection) await connection.close();
  }
}

export const coinSwitchAdapter: ExchangeAdapter = {
  name: "CoinSwitch",
  getFundingRates: fetchSnapshot,
};
