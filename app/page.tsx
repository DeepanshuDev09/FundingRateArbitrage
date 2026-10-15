"use client";
import { useCallback, useEffect, useRef, useState } from "react";
interface Leg { rate: number; intervalHours: number; nextFundingTime: number | null }
interface Row { baseAsset: string; a: Leg; b: Leg; longOn: string; shortOn: string; hourlySpread: number; annualizedSpread: number }
interface Alert { id: number; created_at: string; type: string; message: string; read: boolean }
interface Data { updatedAt: number; status: Record<string, { ok: boolean; count?: number; error?: string }>; spreads: Row[]; alerts: Alert[]; unread: number; health: { last_success_at: string | null }[]; error?: string }
type Key = "baseAsset" | "hourlySpread" | "annualizedSpread";
const pct = (n: number, d = 3) => `${(n * 100).toFixed(d)}%`;
const name = (e: string) => (e === "delta" ? "Delta" : "CoinSwitch");

function Chart({ coin, hours }: { coin: string; hours: number }) {
  const [pts, setPts] = useState<{ t: number; h: number }[] | null>(null);
  useEffect(() => { setPts(null); fetch(`/api/data?history=1&coin=${coin}&hours=${hours}`).then((r) => r.json()).then((j) => setPts(Array.isArray(j) ? j : [])).catch(() => setPts([])); }, [coin, hours]);
  if (!pts) return <p>Loading history…</p>;
  if (pts.length < 2) return <p>No history for {coin} yet. The scheduled check saves a point every 5 minutes.</p>;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t; const hs = pts.map((p) => p.h); const lo = Math.min(...hs, 0), hi = Math.max(...hs);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${(((p.t - t0) / (t1 - t0 || 1)) * 600).toFixed(1)},${(110 - ((p.h - lo) / (hi - lo || 1)) * 100).toFixed(1)}`).join("");
  return <svg viewBox="0 0 600 120" width="100%" role="img" aria-label={`${coin} spread per hour over ${hours} hours`}><path d={d} fill="none" stroke="var(--up)" strokeWidth="2" /><text x="4" y="12" fill="var(--faint)" fontSize="11">peak {pct(hi, 4)}/h</text></svg>;
}

export default function Page() {
  const [data, setData] = useState<Data | null>(null); const [err, setErr] = useState(""); const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: "hourlySpread", dir: -1 });
  const [notify, setNotify] = useState(false); const [sel, setSel] = useState<string | null>(null); const [hrs, setHrs] = useState(24);
  const lastId = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const d: Data = await (await fetch("/api/data")).json(); setData(d); setErr("");
      const top = d.alerts[0]?.id ?? 0;
      if (lastId.current !== null && top > lastId.current && notify && Notification.permission === "granted") new Notification("Funding monitor", { body: d.alerts[0].message });
      lastId.current = top;
    } catch (e) { setErr(String(e)); }
  }, [notify]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => { document.title = `${data?.unread ? `(${data.unread}) ` : ""}αFunding`; }, [data?.unread]);

  const readAll = async () => { await fetch("/api/data", { method: "POST" }); load(); };
  const toggleNotify = async () => { if (!notify && Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") return; setNotify(!notify); };
  const rows = (data?.spreads ?? []).filter((r) => r.baseAsset.includes(q.trim().toUpperCase())).sort((x, y) => (x[sort.k] > y[sort.k] ? 1 : -1) * sort.dir);
  const th = (k: Key, label: string) => <th onClick={() => setSort({ k, dir: sort.k === k ? (-sort.dir as 1 | -1) : -1 })}>{label}{sort.k === k ? (sort.dir === -1 ? " ↓" : " ↑") : ""}</th>;
  const nf = (r: Row) => { const t = r.a.nextFundingTime ?? r.b.nextFundingTime; return t ? new Date(t).toLocaleTimeString() : "-"; };
  const lastOk = data?.health.map((h) => h.last_success_at).filter(Boolean).sort().pop();

  return (<div className="wrap">
    <header><div className="logo"><i>α</i>Funding</div>
      <div className="bar" style={{ margin: 0 }}>{data && Object.entries(data.status).map(([k, s]) => <span key={k} className={`chip ${s.ok ? "ok" : "bad"}`} title={s.error}>{name(k)}: {s.ok ? `${s.count} markets` : "error"}</span>)}
        <a href="#alerts"><button className="dark">Alerts{data?.unread ? ` (${data.unread})` : ""}</button></a></div></header>
    <h1>Funding rate spreads, in real time.</h1>
    <p className="sub">Delta India against CoinSwitch for every coin listed on both. Ranked by the hourly funding you would earn with a hedged long and short. Click a coin to see its history.</p>
    <div className="bar">
      <input placeholder="Filter coin, e.g. BTC" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter coin" />
      <button onClick={toggleNotify}>{notify ? "Pop-ups on" : "Pop-up when tab open"}</button><button className="dark" onClick={load}>Refresh</button>
      <span className="chip">{data ? `Updated ${new Date(data.updatedAt).toLocaleTimeString()}` : "Loading…"}</span>
      <span className="chip" title="Last time the scheduled check succeeded">{lastOk ? `Last scheduled check ${new Date(lastOk).toLocaleTimeString()}` : "Scheduled check has not run yet"}</span>
    </div>
    {err && <p className="down">Could not load rates: {err}</p>}{data?.error && <p className="down">{data.error}</p>}
    <div className="card tw"><table><thead><tr>{th("baseAsset", "Coin")}<th>Delta</th><th>CoinSwitch</th>{th("hourlySpread", "Spread / hour")}{th("annualizedSpread", "Annualized")}<th>Direction</th><th>Next funding</th></tr></thead>
      <tbody>{rows.map((r) => (<tr key={r.baseAsset} onClick={() => setSel(r.baseAsset)} style={{ cursor: "pointer" }} className={sel === r.baseAsset ? "sel" : ""}>
        <td>{r.baseAsset}</td><td className={r.a.rate < 0 ? "down" : "up"}>{pct(r.a.rate)}<small> /{r.a.intervalHours}h</small></td><td className={r.b.rate < 0 ? "down" : "up"}>{pct(r.b.rate)}<small> /{r.b.intervalHours}h</small></td>
        <td className="up">{pct(r.hourlySpread, 4)}</td><td className="up">{(r.annualizedSpread * 100).toFixed(1)}%</td><td>Long {name(r.longOn)} · Short {name(r.shortOn)}</td><td>{nf(r)}</td></tr>))}
        {data && rows.length === 0 && <tr><td colSpan={7}>No matching coins. Check the exchange badges at the top.</td></tr>}</tbody></table></div>
    {sel && <div className="card pad"><h2>{sel} spread per hour</h2><div className="bar">{[6, 24, 168].map((h) => <button key={h} onClick={() => setHrs(h)} className={h === hrs ? "dark" : ""}>{h === 168 ? "7d" : `${h}h`}</button>)}</div><Chart coin={sel} hours={hrs} /></div>}
    <div className="card pad" id="alerts"><h2>Alerts {data?.unread ? <span className="chip ok">{data.unread} unread</span> : null}<button style={{ marginLeft: "auto" }} onClick={readAll}>Mark all read</button></h2>
      {data?.alerts.length ? data.alerts.map((a) => <p key={a.id} className={a.read ? "" : "new"}><span className={`chip ${a.type === "opportunity" || a.type === "recovery" ? "ok" : a.type === "outage" ? "bad" : ""}`}>{a.type}</span> {new Date(a.created_at).toLocaleString()} · {a.message}</p>)
        : <p>No alerts yet. They appear here when a spread beats your threshold after estimated fees.</p>}</div>
    <p className="note">Not financial advice. Estimated fees are a placeholder until you set FEE_ROUND_TRIP_PCT. Spreads exclude slippage and funding changes before payout. Verify each exchange's funding units and interval first.</p>
  </div>);
}
