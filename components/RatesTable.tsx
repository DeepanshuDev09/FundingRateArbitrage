"use client";

import { useMemo, useState } from "react";
import type { FundingSpread, RatesSnapshot } from "@/lib/models";

type SortKey =
  | "coin"
  | "deltaRate"
  | "coinSwitchRate"
  | "deltaIntervalHours"
  | "coinSwitchIntervalHours"
  | "normalizedHourlySpread"
  | "annualizedSpread";

interface RatesTableProps {
  initialSnapshot: RatesSnapshot;
}

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 5,
  minimumFractionDigits: 0,
});

function percent(value: number): string {
  return `${numberFormat.format(value * 100)}%`;
}

function time(value: string | null): string {
  if (!value) return "Not in ticker";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

function directionLabel(direction: FundingSpread["direction"]): string {
  if (direction === "long-delta-short-coinswitch") return "Long Delta / Short CoinSwitch";
  if (direction === "long-coinswitch-short-delta") return "Long CoinSwitch / Short Delta";
  return "No funding spread";
}

function StatusCard({
  title,
  status,
}: {
  title: string;
  status: RatesSnapshot["exchanges"]["delta"];
}) {
  const healthy = status.status === "ok";
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-white">{title}</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${healthy ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>
          {healthy ? "OK" : "Error"}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{status.message}</p>
      {status.updatedAt && <p className="mt-2 text-xs text-slate-500">Feed time: {time(status.updatedAt)}</p>}
    </section>
  );
}

export function RatesTable({ initialSnapshot }: RatesTableProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("annualizedSpread");
  const [ascending, setAscending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const normalizedFilter = filter.trim().toUpperCase();
    return [...snapshot.spreads]
      .filter((spread) => !normalizedFilter || spread.coin.includes(normalizedFilter))
      .sort((a, b) => {
        const left = a[sortKey];
        const right = b[sortKey];
        const comparison = typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : Number(left) - Number(right);
        return comparison * (ascending ? 1 : -1);
      });
  }, [filter, snapshot.spreads, sortKey, ascending]);

  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const response = await fetch("/api/rates?refresh=1", { cache: "no-store" });
      if (!response.ok) throw new Error(`Refresh failed with HTTP ${response.status}.`);
      const nextSnapshot: RatesSnapshot = await response.json();
      setSnapshot(nextSnapshot);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshing(false);
    }
  }

  function changeSort(key: SortKey) {
    if (sortKey === key) setAscending((value) => !value);
    else {
      setSortKey(key);
      setAscending(key === "coin");
    }
  }

  function heading(label: string, key: SortKey) {
    return (
      <th key={key} className="whitespace-nowrap px-4 py-3 text-left font-semibold">
        <button className="hover:text-cyan-300" onClick={() => changeSort(key)}>
          {label}{sortKey === key ? (ascending ? " ↑" : " ↓") : ""}
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm leading-6 text-amber-100">
        <strong className="font-semibold">Data interpretation needs verification.</strong>{" "}
        Delta rate units/sign are not documented in the cited ticker schema; its ticker omits the next payout time.
        CoinSwitch is provisionally treated as a decimal rate with an 8-hour interval based on the sample timestamp.
        Direction uses the conventional rule that positive funding is paid by longs. Check the exchange terms before
        relying on comparisons.
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <StatusCard title="Delta Exchange India" status={snapshot.exchanges.delta} />
        <StatusCard title="CoinSwitch" status={snapshot.exchanges.coinSwitch} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Matched perpetual markets</h2>
          <p className="mt-1 text-sm text-slate-400">
            {snapshot.updatedAt ? `Latest source update: ${time(snapshot.updatedAt)}` : "No source timestamp available"}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="coin-filter">Filter by coin</label>
          <input
            id="coin-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter coin (e.g. BTC)"
            className="min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
          />
          <button
            onClick={refresh}
            disabled={refreshing}
            className="min-h-11 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {refreshError && (
        <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-sm text-rose-200">
          {refreshError}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/70">
        <table className="w-full min-w-[1160px] border-collapse text-sm">
          <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {[
                heading("Coin", "coin"),
                heading("Delta rate", "deltaRate"),
                heading("CoinSwitch rate", "coinSwitchRate"),
                heading("Delta interval", "deltaIntervalHours"),
                heading("CoinSwitch interval", "coinSwitchIntervalHours"),
                heading("Hourly spread (Delta − CS)", "normalizedHourlySpread"),
                heading("Annualized spread", "annualizedSpread"),
              ]}
              <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Suggested direction</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Next funding time (UTC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {rows.map((row) => (
              <tr key={row.coin} className="hover:bg-slate-800/40">
                <td className="px-4 py-4 font-semibold text-white">{row.coin}</td>
                <td className="px-4 py-4 tabular-nums">{percent(row.deltaRate)}</td>
                <td className="px-4 py-4 tabular-nums">{percent(row.coinSwitchRate)}</td>
                <td className="px-4 py-4 text-slate-300">{row.deltaIntervalHours}h</td>
                <td className="px-4 py-4 text-slate-300">{row.coinSwitchIntervalHours}h*</td>
                <td className="px-4 py-4 tabular-nums">{percent(row.normalizedHourlySpread)}/h</td>
                <td className="px-4 py-4 tabular-nums">{percent(row.annualizedSpread)}</td>
                <td className="px-4 py-4 text-cyan-200">{directionLabel(row.direction)}</td>
                <td className="px-4 py-4 text-xs leading-5 text-slate-400">
                  Delta: {time(row.deltaNextFundingTime)}
                  <br />
                  CoinSwitch: {time(row.coinSwitchNextFundingTime)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                  No overlapping markets{snapshot.spreads.length === 0 ? " are currently available." : " match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        * CoinSwitch interval is a provisional assumption. Annualization is a simple 8,760-hour extrapolation; fees,
        slippage, basis risk, and changes before funding settlement are excluded.
      </p>
    </div>
  );
}
