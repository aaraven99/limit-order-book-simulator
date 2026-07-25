"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Download, RefreshCw, Search } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type MarketBar = { time: string; open: number; high: number; low: number; close: number; volume: number };
type Snapshot = {
  ticker: string;
  provider: string;
  updatedAt: string;
  meta: Record<string, number | string>;
  bars: MarketBar[];
};

function cash(value: number | undefined) {
  return value === undefined ? "—" : `$${value.toFixed(2)}`;
}

export function LiveMarketMonitor() {
  const [ticker, setTicker] = useState("AAPL");
  const [query, setQuery] = useState("AAPL");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/market?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" });
        const body = await response.json() as Snapshot & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Real market data is unavailable.");
        if (!cancelled) setSnapshot(body);
      } catch (caught) {
        if (!cancelled) {
          setSnapshot(null);
          setError(caught instanceof Error ? caught.message : "Real market data is unavailable.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [ticker, refreshKey]);

  const metrics = useMemo(() => {
    if (!snapshot?.bars.length) return null;
    const first = snapshot.bars[0];
    const last = snapshot.bars.at(-1)!;
    return {
      first,
      last,
      change: last.close - first.open,
      high: Math.max(...snapshot.bars.map((bar) => bar.high)),
      low: Math.min(...snapshot.bars.map((bar) => bar.low)),
      volume: snapshot.bars.reduce((total, bar) => total + bar.volume, 0),
    };
  }, [snapshot]);

  function submitTicker() {
    const clean = query.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);
    if (clean) setTicker(clean);
  }

  function exportCsv() {
    if (!snapshot) return;
    const csv = [
      "time,open,high,low,close,volume",
      ...snapshot.bars.map((bar) => `${bar.time},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${ticker.toLowerCase()}-observed-market-bars.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <main className="shell">
    <nav className="nav"><div className="brand"><span className="mark"><Activity size={21}/></span>AARAV / QUANT LABS</div><span className="badge"><span className="dot"/> real market bars only</span></nav>
    <section className="hero"><div><span className="badge">provider-reported intraday activity</span><h1>Market <span className="gradient">Microstructure Monitor</span></h1><p className="lede">Inspect observed one-minute prices and volume for any supported symbol. The public demo no longer fabricates a depth ladder or browser-local executions.</p></div><p className="hero-note">A free public source does not expose consolidated Level 2 order-book depth. This monitor displays only fields the provider actually reports and fails visibly when that source is unavailable.</p></section>
    <section className="workspace">
      <aside className="panel controls"><div className="head"><h2>Real market query</h2><Search size={15}/></div><div className="fields">
        <label>Symbol<input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") submitTicker(); }}/></label>
        <button className="primary" onClick={submitTicker}><Search size={14}/>Load symbol</button>
        <button className="secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={14}/>Refresh now</button>
        <button className="secondary" onClick={exportCsv} disabled={!snapshot}><Download size={14}/>Export observed CSV</button>
        <div className="panel method"><strong>Source policy</strong><p>No seeded book, generated order, hypothetical fill, or synthetic quote is rendered. For genuine Level 2 depth, connect a licensed venue feed server-side.</p></div>
        {error && <div className="error" role="alert">{error} No fallback data was generated.</div>}
      </div></aside>
      <div className="content">
        {!snapshot || !metrics ? <article className="panel method"><h2>{loading ? "Loading real market data…" : "Provider unavailable"}</h2><p>The dashboard remains empty until a provider response contains complete observed bars.</p></article> : <>
          <section className="panel ticker">{[
            ["Last", cash(metrics.last.close)],
            ["Open", cash(metrics.first.open)],
            ["High", cash(metrics.high)],
            ["Low", cash(metrics.low)],
            ["Change", `${metrics.change >= 0 ? "+" : ""}${metrics.change.toFixed(2)}`],
            ["Volume", metrics.volume.toLocaleString()],
            ["Bars", snapshot.bars.length.toString()],
            ["Mode", "REAL ONLY"],
          ].map(([label, value]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>{ticker}</small></article>)}</section>
          <div className="panels">
            <article className="panel chart"><div className="head"><div><h2>Observed price path</h2><p>{snapshot.provider} · {new Date(snapshot.updatedAt).toLocaleString()}</p></div></div><div className="chart-box"><ResponsiveContainer><AreaChart data={snapshot.bars}><CartesianGrid stroke="rgba(148,163,184,.1)"/><XAxis dataKey="time" hide/><YAxis domain={["auto","auto"]} stroke="#748196"/><Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleString()}/><Area dataKey="close" stroke="#60a5fa" fill="#60a5fa22"/></AreaChart></ResponsiveContainer></div></article>
            <article className="panel chart"><div className="head"><div><h2>Observed volume</h2><p>Provider-reported one-minute volume</p></div></div><div className="chart-box"><ResponsiveContainer><BarChart data={snapshot.bars}><CartesianGrid stroke="rgba(148,163,184,.1)"/><XAxis dataKey="time" hide/><YAxis stroke="#748196"/><Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleString()}/><Bar dataKey="volume" fill="#22d3ee"/></BarChart></ResponsiveContainer></div></article>
          </div>
          <article className="panel chart"><div className="head"><div><h2>Recent observed bars</h2><p>OHLCV fields exactly as returned after validation</p></div></div><div className="table-wrap"><table><thead><tr><th>Time</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead><tbody>{snapshot.bars.slice(-25).reverse().map((bar) => <tr key={bar.time}><td>{new Date(bar.time).toLocaleTimeString()}</td><td>{cash(bar.open)}</td><td>{cash(bar.high)}</td><td>{cash(bar.low)}</td><td>{cash(bar.close)}</td><td>{bar.volume.toLocaleString()}</td></tr>)}</tbody></table></div></article>
        </>}
      </div>
    </section>
    <section className="panel method"><h2>Data limitations</h2><p>This public monitor is not a broker, exchange, SIP, or licensed depth feed. It cannot display queue position, hidden liquidity, venue routing, executable size, or consolidated best bid and offer. It is useful for observed intraday OHLCV research, not order placement or execution decisions.</p></section>
  </main>;
}
