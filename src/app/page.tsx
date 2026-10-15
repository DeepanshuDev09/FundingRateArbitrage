"use client";
import { useCallback, useEffect, useState } from "react";
interface Leg { rate: number; intervalHours: number; nextFundingTime: number | null }
interface Row { baseAsset: string; a: Leg; b: Leg; longOn: string; shortOn: string; hourlySpread: number; annualizedSpread: number }
interface Data { updatedAt: number; status: Record<string, { ok: boolean; count?: number; error?: string }>; top: Row[] }
const pct = (n: number, d = 3) => `${(n * 100).toFixed(d)}%`;
const name = (e: string) => (e === "delta" ? "Delta" : "CoinSwitch");
const rateCls = (n: number) => (n < 0 ? "down" : "up");

export default function Page() {
  const [data, setData] = useState<Data | null>(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState("");
  const scan = useCallback(async () => { // scan starts automatically when the page opens
    setLoading(true); setErr("");
    try { setData(await (await fetch("/api/rates")).json()); } catch (e) { setErr(String(e)); }
    setLoading(false);
  }, []);
  useEffect(() => { scan(); }, [scan]);

  return (<div className="wrap">
    <header><div className="logo"><i>α</i>Funding</div>
      <div className="bar" style={{ margin: 0 }}>{data && Object.entries(data.status).map(([k, s]) => <span key={k} className={`chip ${s.ok ? "ok" : "bad"}`} title={s.error}>{name(k)}: {s.ok ? `${s.count} markets` : "error"}</span>)}</div></header>
    <h1>Top 5 funding rate differences.</h1>
    <p className="sub">Delta India against CoinSwitch, scanned live when you open this page. A hedged long and short on these pairs earns the spread shown.</p>
    <div className="bar"><button onClick={scan} disabled={loading}>{loading ? "Scanning both exchanges…" : "Scan again"}</button>
      {data && !loading && <span className="chip">Scanned {new Date(data.updatedAt).toLocaleTimeString()}</span>}</div>
    {err && <p className="down">Could not scan: {err}</p>}
    {data && !loading && data.top.length === 0 && <p className="sub">No pairs to show. {Object.values(data.status).some((s) => !s.ok) ? "One exchange failed. Hover its red badge at the top for the reason." : "No coin passed the volume filter."}</p>}
    {data?.top.map((r) => { const nf = r.a.nextFundingTime ?? r.b.nextFundingTime; return (
      <div className="card" key={r.baseAsset}>
        <div className="top"><span className="coin">{r.baseAsset.slice(0, 4)}</span><div><b>{r.baseAsset}</b><small>Perpetual futures</small></div>
          <span className="dir">Long {name(r.longOn)} · Short {name(r.shortOn)}</span></div>
        <div className="grid">
          <div><span>Delta funding</span><div className={rateCls(r.a.rate)}>{pct(r.a.rate)} / {r.a.intervalHours}h</div></div>
          <div><span>CoinSwitch funding</span><div className={rateCls(r.b.rate)}>{pct(r.b.rate)} / {r.b.intervalHours}h</div></div>
          <div><span>Spread per hour</span><div className="up">{pct(r.hourlySpread, 4)}</div></div>
          <div><span>Annualized</span><div className="up">{(r.annualizedSpread * 100).toFixed(1)}%</div></div>
        </div>{nf && <p className="note" style={{ margin: "14px 0 0" }}>Next funding {new Date(nf).toLocaleTimeString()}</p>}</div>); })}
    <p className="note">Not financial advice. Spreads exclude trading fees, slippage and funding changes before payout. Check each exchange&apos;s funding unit and interval against its app before acting.</p>
  </div>);
}
