import { RatesTable } from "@/components/RatesTable";
import { getRatesSnapshot } from "@/lib/rates";

export const runtime = "nodejs";

export default async function Home() {
  const snapshot = await getRatesSnapshot();

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12">
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Funding Rate Arbitrage Monitor
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Perpetual funding rates
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
          Public market data comparison for Delta Exchange India and CoinSwitch.
          Monitoring only — this dashboard does not place orders.
        </p>
      </header>
      <RatesTable initialSnapshot={snapshot} />
    </main>
  );
}
