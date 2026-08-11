"use client";

import { useMemo, useState } from "react";
import type { DashboardSnapshot, IndexQuote } from "@/lib/dashboard-types";

type Props={initialSnapshot:DashboardSnapshot};
const pct=(v:number|null)=>v===null?"—":`${v>=0?"+":""}${v.toFixed(2)}%`;
const num=(v:number|null)=>v===null?"—":v.toLocaleString("en-IN",{maximumFractionDigits:2});
const moveClass=(v:number|null)=>v===null?"muted":v>0?"positive":v<0?"negative":"muted";
const actionClass=(a:string)=>a==="BUY ON DIP"?"buy":a==="SIP"?"sip":a==="AVOID TODAY"?"avoid":"wait";

function IndexCard({idx}:{idx:IndexQuote}){return <article className="index-card"><div className="index-card-top"><span>{idx.name}</span><span className={moveClass(idx.changePct)}>{pct(idx.changePct)}</span></div><div className="index-value">{num(idx.value)}</div><div className="index-meta"><span>5D {pct(idx.fiveDayPct)}</span><span>1M {pct(idx.oneMonthPct)}</span><span className="trend">{idx.trend}</span></div></article>}

export default function DashboardClient({initialSnapshot}:Props){
 const [snapshot,setSnapshot]=useState(initialSnapshot); const [loading,setLoading]=useState(false); const [error,setError]=useState<string|null>(null); const [tab,setTab]=useState<"funds"|"indices">("funds");
 const lastUpdated=useMemo(()=>new Date(snapshot.generatedAt).toLocaleTimeString("en-IN",{hour12:false}),[snapshot.generatedAt]);
 async function refresh(){setLoading(true);setError(null);try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);const res=await fetch("/api/dashboard/refresh",{signal:controller.signal,cache:"no-store"});clearTimeout(timer);const data=await res.json();if(!res.ok||!data.ok||!data.snapshot)throw new Error(data.error||"Refresh failed");setSnapshot(data.snapshot);}catch(e){setError(e instanceof Error?e.message:"Unable to refresh");}finally{setLoading(false);}}
 return <main className="terminal-shell">
  <header className="terminal-header">
   <div><div className="eyebrow">MARKET INTELLIGENCE • INDIA</div><h1>Smart MF Daily Decision Terminal</h1><p>Market regime, NIFTY sectors, fund NAVs and tactical allocation — automated.</p></div>
   <div className="header-actions"><div className="freshness"><span className="live-dot"/> Updated {lastUpdated}</div><button onClick={refresh} disabled={loading} className="refresh-btn">{loading?"Refreshing…":"↻ Refresh Live Data"}</button></div>
  </header>
  {snapshot.sourceWarnings.length>0&&<div className="source-banner"><b>Data status:</b> {snapshot.sourceWarnings.join(" • ")}</div>}
  {error&&<div className="error-banner">{error}</div>}

  <section className={`regime-banner ${snapshot.regime.badge.toLowerCase()}`}><div><span className="regime-label">{snapshot.regime.label}</span><div className="regime-note">{snapshot.regime.strategyNote}</div></div><div className="breadth"><span>Sector breadth</span><strong>{snapshot.regime.breadthPositivePct.toFixed(1)}%</strong><small>positive</small></div></section>

  <section className="section-block"><div className="section-heading"><div><span className="section-kicker">MARKET OVERVIEW</span><h2>Main NIFTY Indices</h2></div><span className="section-note">Live market snapshot</span></div><div className="index-grid">{snapshot.headlineIndices.map(i=><IndexCard key={i.key} idx={i}/>)}</div></section>

  <section className="two-col">
   <div className="panel"><div className="panel-title"><h3>Largest Sector Declines</h3><span>Today</span></div>{snapshot.fallingIndices.map(i=><div className="rank-row" key={i.key}><span>{i.name}</span><b className="negative">{pct(i.changePct)}</b></div>)}</div>
   <div className="panel"><div className="panel-title"><h3>Strongest Sectors</h3><span>Today</span></div>{snapshot.strongestIndices.map(i=><div className="rank-row" key={i.key}><span>{i.name}</span><b className={moveClass(i.changePct)}>{pct(i.changePct)}</b></div>)}</div>
  </section>

  <section className="section-block"><div className="section-heading"><div><span className="section-kicker">DECISION ENGINE</span><h2>Fund Opportunities</h2></div><div className="tabs"><button className={tab==="funds"?"active":""} onClick={()=>setTab("funds")}>Fund Signals</button><button className={tab==="indices"?"active":""} onClick={()=>setTab("indices")}>Index Table</button></div></div>
   {tab==="funds"?<>
    <div className="fund-table-wrap"><table className="fund-table"><thead><tr><th>Fund</th><th>Latest NAV</th><th>NAV Date</th><th>Market Proxy</th><th>Today</th><th>Score</th><th>Decision</th></tr></thead><tbody>{snapshot.allFunds.map(f=><tr key={f.id}><td><strong>{f.name}</strong><small>{f.proxyLabel}</small></td><td className="nav">{f.technical.latestNav===null?"—":`₹${f.technical.latestNav.toFixed(4)}`}</td><td>{f.technical.navDate??"—"}</td><td>{f.proxyLabel}</td><td className={moveClass(f.proxyMovePct)}>{pct(f.proxyMovePct)}</td><td><span className="score">{f.finalScore.toFixed(1)}</span></td><td><span className={`decision ${actionClass(f.actionTag)}`}>{f.actionTag}</span></td></tr>)}</tbody></table></div>
    <div className="nav-source-note">NAV source: AMFI daily NAV feed. Mutual fund NAV is declared after market close; it is not an intraday traded price.</div>
   </>:<div className="fund-table-wrap"><table className="fund-table"><thead><tr><th>Index</th><th>Today</th><th>5D</th><th>1M</th><th>3M</th><th>52W</th><th>20DMA</th><th>50DMA</th><th>200DMA</th><th>Trend</th></tr></thead><tbody>{snapshot.indexTable.map(i=><tr key={i.key}><td><strong>{i.name}</strong></td><td className={moveClass(i.changePct)}>{pct(i.changePct)}</td><td>{pct(i.fiveDayPct)}</td><td>{pct(i.oneMonthPct)}</td><td>{pct(i.threeMonthPct)}</td><td>{pct(i.fiftyTwoWeekPct)}</td><td>{num(i.sma20)}</td><td>{num(i.sma50)}</td><td>{num(i.sma200)}</td><td>{i.trend}</td></tr>)}</tbody></table></div>}
  </section>

  <section className="section-block"><div className="section-heading"><div><span className="section-kicker">TACTICAL VIEW</span><h2>Top 5 Funds Today</h2></div><span className="section-note">Highest composite score</span></div><div className="top-funds">{snapshot.topFunds.map((f,n)=><article className="fund-card" key={f.id}><div className="fund-rank">#{n+1}</div><div className="fund-card-main"><h3>{f.name}</h3><div className="fund-line"><span>{f.proxyLabel}</span><b className={moveClass(f.proxyMovePct)}>{pct(f.proxyMovePct)}</b></div><div className="score-line"><span>Strategic <b>{f.strategicScore}</b></span><span>Opportunity <b>{f.opportunityScore}</b></span><span>Final <b>{f.finalScore}</b></span></div><div className="fund-footer"><span>NAV {f.technical.latestNav===null?"—":`₹${f.technical.latestNav.toFixed(4)}`}</span><span className={`decision ${actionClass(f.actionTag)}`}>{f.actionTag}</span></div></div></article>)}</div></section>

  <section className="section-block"><div className="section-heading"><div><span className="section-kicker">SECTOR ROTATION</span><h2>Sector Heatmap</h2></div></div><div className="heatmap">{snapshot.sectorHeatmap.map(i=><div key={i.key} className={`heat-cell ${(i.changePct??0)>=0?"up":"down"}`}><span>{i.name.replace("NIFTY ","")}</span><strong>{pct(i.changePct)}</strong></div>)}</div></section>

  <section className="section-block cutoff-card"><div><span className="section-kicker">NAV EXECUTION</span><h2>Same-Day NAV Cut-off</h2><p>{snapshot.cutoffLabel}</p></div><div className="progress"><div style={{width:`${Math.min(snapshot.cutoffProgressPct,100)}%`}}/></div></section>

  <footer className="terminal-footer"><div><b>Smart MF Daily Decision Terminal</b><span>Probability-based signals • not guaranteed returns or NAV predictions.</span></div><div>Market data may be delayed or unavailable. Proxy mapping is an approximation.</div></footer>
 </main>;
}
