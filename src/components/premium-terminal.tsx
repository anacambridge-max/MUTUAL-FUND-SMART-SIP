"use client";

import { useMemo, useState } from "react";
import type { DashboardSnapshot, IndexQuote, ScoredFund } from "@/lib/dashboard-types";

type Props = { initialSnapshot: DashboardSnapshot };

const pct = (v: number | null) => v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const score = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const moveClass = (v: number | null) => v == null ? "muted" : v < 0 ? "negative" : "positive";

const portfolio = [
  ["Nifty 50", "Core Large Cap", 20], ["Nifty Next 50", "Large Cap Growth", 8],
  ["Nifty Midcap 150", "Mid Cap Growth", 12], ["Nifty Smallcap 250", "Small Cap Growth", 8],
  ["Nifty 500 / Multicap", "Broad Diversification", 7], ["Nifty Bank", "Banking", 5],
  ["Nifty Financial Services", "Financial Ecosystem", 4], ["Nifty IT", "Technology", 4],
  ["Nifty Pharma", "Pharma", 4], ["Nifty Auto", "Auto / EV / Ancillary", 3],
  ["Nifty FMCG", "Defensive Consumption", 3], ["Nifty Metal", "Cyclical / Commodity", 3],
  ["Nifty Healthcare", "Healthcare", 3], ["Nifty Infrastructure", "Infrastructure / Capex", 3],
  ["Nifty Realty", "Real Estate", 3], ["Debt / Liquid", "Stability Reserve", 5], ["Gold", "Diversifier", 3],
] as const;

function technicalScore(index: IndexQuote, fund?: ScoredFund) {
  const daily = index.changePct == null ? 50 : score(50 - index.changePct * 7);
  const medium = index.oneMonthPct == null ? 50 : score(50 + index.oneMonthPct * 2.5);
  const long = index.threeMonthPct == null ? 50 : score(50 + index.threeMonthPct * 1.1);
  const strategic = fund?.strategicScore ?? 50;
  return score(daily * .30 + medium * .25 + long * .20 + strategic * .25);
}

function opportunityScore(index: IndexQuote, fund?: ScoredFund) {
  const fall = index.changePct == null ? 0 : score(-index.changePct * 18);
  const tech = technicalScore(index, fund);
  const health = fund?.opportunityScore ?? 50;
  const discount = index.fiftyTwoWeekPct == null ? 50 : score(Math.max(0, -index.fiftyTwoWeekPct) * 2.2 + 35);
  return score(fall * .35 + tech * .25 + health * .25 + discount * .15);
}

function action(scoreValue: number, index: IndexQuote, fund?: ScoredFund) {
  if (!fund || index.changePct == null) return "WAIT";
  if (fund.classification === "STRUCTURAL_BREAKDOWN") return "AVOID";
  if (scoreValue >= 82) return "STRONG BUY";
  if (scoreValue >= 70) return "ACCUMULATE";
  if (scoreValue >= 55) return "WATCH";
  return "WAIT";
}

function findFund(index: IndexQuote, snapshot: DashboardSnapshot) {
  return snapshot.allFunds.find(f => f.proxyKey === index.key) ?? snapshot.lowerNavOpportunities.find(f => f.proxyKey === index.key);
}

export default function PremiumTerminal({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"dashboard" | "portfolio">("dashboard");

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/refresh", { cache: "no-store" });
      const data = await response.json();
      if (data.ok && data.snapshot) setSnapshot(data.snapshot);
    } finally { setLoading(false); }
  }

  const sectors = useMemo(() => snapshot.sectorHeatmap.filter(x => x.isSector).sort((a, b) => (a.changePct ?? 999) - (b.changePct ?? 999)), [snapshot]);
  const funds = snapshot.allFunds;
  const ranked = useMemo(() => sectors.map(index => {
    const fund = findFund(index, snapshot);
    const technical = technicalScore(index, fund);
    const opportunity = opportunityScore(index, fund);
    return { index, fund, technical, opportunity, action: action(opportunity, index, fund) };
  }).sort((a, b) => b.opportunity - a.opportunity), [sectors, snapshot]);
  const topLosers = sectors.slice(0, 10);
  const primary = ranked[0];
  const now = new Date(snapshot.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

  return <main className="premium-terminal">
    <header className="premium-header">
      <div>
        <div className="brand-line"><span className="brand-mark">SM</span><span>SMART MF TERMINAL</span><em>INDIA</em></div>
        <h1>Daily Mutual Fund Decision Engine</h1>
        <p>Start with the biggest sector/index fall. Then confirm whether the weakness is a discount, a healthy correction or a structural breakdown.</p>
      </div>
      <div className="header-right">
        <span className="market-pill"><i /> MARKET DATA {snapshot.sourceWarnings.length ? "PARTIAL" : "VERIFIED"}</span>
        <span className="updated">Updated {now} IST</span>
        <button onClick={refresh} disabled={loading}>{loading ? "Refreshing…" : "↻ Refresh"}</button>
      </div>
    </header>

    <nav className="terminal-nav">
      <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>Decision Cockpit</button>
      <button className={view === "portfolio" ? "active" : ""} onClick={() => setView("portfolio")}>Long-Term Portfolio</button>
      <span>2:30 PM DAILY SCAN</span>
    </nav>

    {view === "dashboard" ? <>
      <section className="decision-hero">
        <div className="hero-copy"><span className="eyebrow">2:30 PM PRIORITY SIGNAL</span><h2>{primary?.index.name ?? "No validated opportunity"}</h2><div className="hero-move">{primary ? pct(primary.index.changePct) : "—"}</div><p>{primary?.fund?.reason ?? "Waiting for validated market and NAV data."}</p></div>
        <div className="hero-score"><span>OPPORTUNITY SCORE</span><strong>{primary?.opportunity ?? 0}</strong><small>/ 100</small><b>{primary?.action ?? "WAIT"}</b></div>
        <div className="hero-metrics"><Metric label="Technical / Trend" value={primary?.technical ?? 0}/><Metric label="Correction Priority" value={primary ? score(-(primary.index.changePct ?? 0) * 18) : 0}/><Metric label="Fund Signal" value={primary?.fund?.finalScore ?? 0}/></div>
      </section>

      <section className="warning-strip"><strong>Largest fall is the first filter — not the final buy condition.</strong><span>Final decision = correction + technical/trend + fund signal + discount + reason/risk.</span></section>

      <section className="grid-main">
        <div className="panel heat-panel"><PanelTitle kicker="MARKET MAP" title="Nifty Sector Heatmap" right="Sort: biggest fall"/><div className="heat-grid">{sectors.map(s => <HeatCell key={s.key} item={s} score={opportunityScore(s, findFund(s, snapshot))}/>)}</div></div>
        <div className="panel losers-panel"><PanelTitle kicker="FIRST LOOK" title="Top 10 Sector Losers" right="Today"/><div className="loser-list">{topLosers.map((s, i) => <div className="loser-row" key={s.key}><span className="rank">{String(i + 1).padStart(2, "0")}</span><span className="loser-name">{s.name.replace("NIFTY ", "")}</span><b className={moveClass(s.changePct)}>{pct(s.changePct)}</b><span className="mini-score">{opportunityScore(s, findFund(s, snapshot))}</span></div>)}</div></div>
      </section>

      <section className="panel opportunity-panel"><PanelTitle kicker="INVESTMENT ENGINE" title="Top Opportunities — 2:30 PM" right="Ranked after loser scan"/><div className="opportunity-table"><div className="op-head"><span>#</span><span>INDEX / SECTOR</span><span>FALL</span><span>TECHNICAL</span><span>DISCOUNT</span><span>BULL / BEAR</span><span>OPPORTUNITY</span><span>ACTION</span><span>RECOMMENDED FUND</span></div>{ranked.slice(0, 10).map((r, i) => <div className="op-row" key={r.index.key}><span className="rank">{i + 1}</span><span><b>{r.index.name}</b><small>{r.fund?.proxyLabel ?? "Mapped fund unavailable"}</small></span><strong className={moveClass(r.index.changePct)}>{pct(r.index.changePct)}</strong><ScoreBar value={r.technical}/><ScoreBar value={r.index.fiftyTwoWeekPct == null ? 50 : score(Math.max(0, -r.index.fiftyTwoWeekPct) * 2.2 + 35)}/><span className={r.index.trend === "UP" ? "bull" : r.index.trend === "DOWN" ? "bear" : "neutral"}>{r.index.trend === "UP" ? "BULLISH" : r.index.trend === "DOWN" ? "BEARISH" : "NEUTRAL"}</span><strong className="op-score">{r.opportunity}</strong><span className={`action-chip ${r.action.toLowerCase().replace(" ", "-")}`}>{r.action}</span><span className="fund-name">{r.fund?.name ?? "No mapped fund"}</span></div>)}</div></section>

      <section className="grid-main">
        <div className="panel"><PanelTitle kicker="WHY THE FALL MATTERS" title="Top 5 Deep Corrections"/><div className="deep-list">{ranked.slice(0, 5).map(r => <div className="deep-card" key={r.index.key}><div><b>{r.index.name}</b><small>1M {pct(r.index.oneMonthPct)} · 3M {pct(r.index.threeMonthPct)}</small></div><strong className={moveClass(r.index.changePct)}>{pct(r.index.changePct)}</strong><span>{r.fund?.classification === "STRUCTURAL_BREAKDOWN" ? "STRUCTURAL RISK" : r.index.trend === "DOWN" ? "BEARISH TREND" : "CORRECTION / REVIEW"}</span></div>)}</div></div>
        <div className="panel"><PanelTitle kicker="PORTFOLIO CONTROL" title="Target Allocation" right="100%"/><div className="allocation-list">{portfolio.slice(0, 10).map(([name, role, weight]) => <div key={name}><span>{name}</span><small>{role}</small><b>{weight}%</b><i><u style={{width: `${weight * 3.2}%`}} /></i></div>)}</div></div>
      </section>
    </> : <PortfolioView snapshot={snapshot} />}

    <footer className="premium-footer"><div><b>Smart MF Terminal</b><span>Decision support — not a guaranteed return or NAV prediction.</span></div><span>AMFI NAV + market proxy data · verify applicable scheme cut-off and funds-realisation rules before investing.</span></footer>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="hero-metric"><span>{label}</span><b>{score(value)}</b><i><u style={{width: `${score(value)}%`}} /></i></div>; }
function ScoreBar({ value }: { value: number }) { return <span className="score-bar"><b>{score(value)}</b><i><u style={{width: `${score(value)}%`}} /></i></span>; }
function PanelTitle({ kicker, title, right }: { kicker: string; title: string; right?: string }) { return <div className="panel-title-premium"><div><span>{kicker}</span><h3>{title}</h3></div>{right && <em>{right}</em>}</div>; }
function HeatCell({ item, score: opportunity }: { item: IndexQuote; score: number }) { const n = item.changePct ?? 0; const intensity = Math.min(0.82, Math.max(0.08, Math.abs(n) / 7)); return <div className={`heat-cell-premium ${n < 0 ? "down" : n > 0 ? "up" : "flat"}`} style={{opacity: 0.35 + intensity * .65}}><span>{item.name.replace("NIFTY ", "")}</span><b>{pct(item.changePct)}</b><small>{opportunity}</small></div>; }
function PortfolioView({ snapshot }: { snapshot: DashboardSnapshot }) { return <><section className="portfolio-hero"><span className="eyebrow">LONG-TERM BALANCED PORTFOLIO</span><h2>Core + Tactical + Defensive</h2><p>Keep the long-term allocation stable. Use the tactical sleeve only when the opportunity engine identifies a high-quality correction.</p><div className="portfolio-buckets"><div><b>CORE</b><strong>55%</strong><small>Long-term equity engine</small></div><div><b>SECTOR / TACTICAL</b><strong>37%</strong><small>Correction opportunities</small></div><div><b>DEFENSIVE</b><strong>8%</strong><small>Debt / Gold reserve</small></div></div></section><section className="panel allocation-full"><PanelTitle kicker="TARGETS" title="17-Exposure Portfolio" right="100%"/><div className="full-grid">{portfolio.map(([name, role, weight]) => <div key={name}><span>{name}</span><small>{role}</small><strong>{weight}%</strong><i><u style={{width: `${weight * 3.2}%`}} /></i></div>)}</div></section><section className="panel"><PanelTitle kicker="LIVE PORTFOLIO SIGNAL" title="Current mapped fund universe"/><div className="fund-grid">{snapshot.allFunds.slice(0, 20).map(f => <div key={f.id}><b>{f.name}</b><small>{f.proxyLabel}</small><span className={moveClass(f.proxyMovePct)}>{pct(f.proxyMovePct)}</span><em>{f.actionTag}</em></div>)}</div></section></>; }
