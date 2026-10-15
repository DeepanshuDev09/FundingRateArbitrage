# Funding Rate Arbitrage Monitor

A monitoring-only Next.js application comparing public perpetual-futures funding rates from Delta Exchange India and CoinSwitch. It does not place orders or require exchange API keys. All exchange connections run in Node.js server code; the browser only calls this app's `/api/rates` route.

## Research status and important verification items

The adapters use the documented Delta India REST endpoints and the documented CoinSwitch public NATS ticker subject:

- Delta: `https://api.india.delta.exchange/v2/products?contract_types=perpetual_futures&states=live` and `https://api.india.delta.exchange/v2/tickers`.
- CoinSwitch: `wss://pc-nats-prod.coinswitch.co`, subject `v1.f.ex1.public.futures.ticker.>`.
- The Delta public product catalog provides `product_specs.rate_exchange_interval`; BTCUSD/ETHUSD currently report 28,800 seconds. Those products are USD-quoted/USD-settled and non-quanto, not INR-settled.
- CoinSwitch's public message documents `r` as funding rate and `T` as the next funding timestamp (Unix milliseconds), and `m` as a `BASE/USDT` market. The cited docs do not specify the funding interval or units/sign convention for `r`.
- The Delta ticker contains `funding_rate` but no next-funding timestamp. The app returns `null` for Delta next-funding time rather than fabricate one.

**Provisional assumptions requiring user verification before relying on computed spreads:** CoinSwitch is treated as an 8-hour funding market based on the sample timestamp's apparent boundary; both APIs' numeric funding rates are treated as decimal fractions; positive rates are treated according to the conventional rule that longs pay shorts. These are prominently exposed in the UI status and are not confirmed by the cited response schemas. Update the relevant mapping/interval/sign logic after confirming official exchange terms.

Official references:

- [Delta API docs](https://docs.delta.exchange/)
- [Delta India tickers](https://api.india.delta.exchange/v2/tickers)
- [Delta India perpetual products](https://api.india.delta.exchange/v2/products?contract_types=perpetual_futures&states=live)
- [CoinSwitch public HFT ticker](https://api-trading.coinswitch.co/hft/sockets/ticker)
- [CoinSwitch HFT socket overview](https://api-trading.coinswitch.co/hft/sockets/overview)
- [CoinSwitch API surfaces](https://api-trading.coinswitch.co/get-started/api-surfaces)
- [CoinSwitch API rate-limit notes](https://api-trading.coinswitch.co/resources/errors-and-rate-limits)

## Local setup

Requirements: Node.js 24+ and npm.

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API is available at [http://localhost:3000/api/rates](http://localhost:3000/api/rates).

No exchange keys are used. `.env.example` only configures public endpoint URLs and snapshot timeout; never add keys with trade permission. Environment variables are server-only and have no `NEXT_PUBLIC_` prefix.

## Tests and checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Adapter parser tests use sample responses matching the official Delta REST and CoinSwitch HFT ticker documentation; they do not submit orders or contact live exchange APIs.

## Vercel deployment

1. Push this project to a Git provider and import it in Vercel as a Next.js project.
2. Keep the default Next.js build settings (`npm run build`).
3. Add the public endpoint values from `.env.example` as Vercel environment variables if the defaults need changing. There are no secrets to set for the public feeds.
4. Deploy and open `/api/rates` to verify each exchange's status. NATS-over-WebSocket connectivity and function duration must be verified on the deployed Vercel plan; the CoinSwitch handler opens a connection, waits for one snapshot, and closes it within a bounded timeout.
5. Confirm the displayed assumptions against the current exchange product terms before using the normalized spread or suggested direction.

The app is stateless: no local files, database, cron, or long-running worker is required. The route uses short server-side caching (30 seconds); manual refresh requests a fresh snapshot. CoinSwitch's public NATS socket is opened only per snapshot and is not held open after the request.

## Interpretation

Rates are provisionally treated as decimal fractions per funding interval. Hourly normalization divides by each interval in hours; annualization is simple linear extrapolation over 8,760 hours, not compounding. Raw spread and normalized spread are Delta minus CoinSwitch. Under the conventional sign rule (positive funding paid by longs), the funding-favorable leg is long the venue with the lower rate and short the venue with the higher rate. Example: Delta `-1%`, CoinSwitch `-2%` implies long CoinSwitch / short Delta, before fees and other risks. The sign convention must be confirmed for both exchanges before relying on this suggestion.

Funding can change before payout. The display excludes fees, slippage, basis risk, liquidity constraints, taxes, and position sizing. Delta's next payout time is unavailable from the cited public ticker and is shown as unavailable; CoinSwitch's `T` value is rendered from its public payload.

## Next milestone

Milestone 2 can add persistent rate history with Upstash Redis or Neon, scheduled checks using Vercel Cron, and Telegram alerts. No database, cron job, or alerting integration is included here.
