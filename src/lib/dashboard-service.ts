import {
  DEFAULT_FUND_MAPPINGS,
  DEFAULT_PROXY_DEFINITIONS,
  DEFAULT_SETTINGS,
  DASHBOARD_DISCLAIMERS,
} from "@/lib/dashboard-defaults";
import type {
  DashboardSettings,
  DashboardSnapshot,
  FundActionTag,
  FundClassification,
  FundMapping,
  IndexQuote,
  ScoredFund,
  TrendState,
} from "@/lib/dashboard-types";

type IndexRow = Record<string, unknown>;
type NavRow = { code: string; name: string; nav: number; date: string };
type TrackedIndex = { key: string; name: string; aliases: string[]; isSector: boolean };

type YahooChart = {
  chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; previousClose?: number }; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
};

const TRACKED: TrackedIndex[] = [
  { key: "NIFTY_50", name: "NIFTY 50", aliases: ["NIFTY 50"], isSector: false },
  { key: "SENSEX", name: "SENSEX", aliases: ["S&P BSE SENSEX", "SENSEX"], isSector: false },
  { key: "MIDCAP_150", name: "NIFTY Midcap 150", aliases: ["NIFTY MIDCAP 150"], isSector: false },
  { key: "SMALLCAP_250", name: "NIFTY Smallcap 250", aliases: ["NIFTY SMALLCAP 250"], isSector: false },
  { key: "NIFTY_NEXT_50", name: "NIFTY Next 50", aliases: ["NIFTY NEXT 50"], isSector: false },
  { key: "LARGEMIDCAP_250", name: "NIFTY LargeMidcap 250", aliases: ["NIFTY LARGEMIDCAP 250"], isSector: false },
  { key: "BANK_NIFTY", name: "NIFTY Bank", aliases: ["NIFTY BANK"], isSector: true },
  { key: "NIFTY_IT", name: "NIFTY IT", aliases: ["NIFTY IT"], isSector: true },
  { key: "NIFTY_AUTO", name: "NIFTY Auto", aliases: ["NIFTY AUTO"], isSector: true },
  { key: "NIFTY_PHARMA", name: "NIFTY Pharma", aliases: ["NIFTY PHARMA"], isSector: true },
  { key: "NIFTY_FMCG", name: "NIFTY FMCG", aliases: ["NIFTY FMCG"], isSector: true },
  { key: "NIFTY_METAL", name: "NIFTY Metal", aliases: ["NIFTY METAL"], isSector: true },
  { key: "NIFTY_REALTY", name: "NIFTY Realty", aliases: ["NIFTY REALTY"], isSector: true },
  { key: "NIFTY_FIN_SERVICE", name: "NIFTY Financial Services", aliases: ["NIFTY FINANCIAL SERVICES"], isSector: true },
  { key: "NIFTY_ENERGY", name: "NIFTY Energy", aliases: ["NIFTY ENERGY"], isSector: true },
  { key: "NIFTY_PSU_BANK", name: "NIFTY PSU Bank", aliases: ["NIFTY PSU BANK"], isSector: true },
  { key: "NIFTY_INFRA", name: "NIFTY Infrastructure", aliases: ["NIFTY INFRASTRUCTURE"], isSector: true },
  { key: "NIFTY_SERVICES", name: "NIFTY Services Sector", aliases: ["NIFTY SERVICES SECTOR"], isSector: true },
  { key: "GOLD_PROXY", name: "Gold Proxy", aliases: ["GOLD"], isSector: false },
];

const YAHOO_SYMBOLS: Record<string, string> = {
  NIFTY_50: "%5ENSEI", SENSEX: "%5EBSESN", MIDCAP_150: "NIFTYMIDCAP150.NS", SMALLCAP_250: "NIFTYSMLCAP250.NS",
  NIFTY_NEXT_50: "NIFTYNXT50.NS", LARGEMIDCAP_250: "NIFTY_LARGEMID250.NS", BANK_NIFTY: "%5ENSEBANK", NIFTY_IT: "%5ECNXIT",
  NIFTY_AUTO: "%5ECNXAUTO", NIFTY_PHARMA: "%5ECNXPHARMA", NIFTY_FMCG: "%5ECNXFMCG", NIFTY_METAL: "%5ECNXMETAL",
  NIFTY_REALTY: "%5ECNXREALTY", NIFTY_FIN_SERVICE: "NIFTYFINSERVICE.NS", NIFTY_ENERGY: "NIFTYENERGY.NS",
  NIFTY_PSU_BANK: "NIFTYPSUBANK.NS", NIFTY_INFRA: "NIFTYINFRA.NS", NIFTY_SERVICES: "NIFTYSERVICES.NS",
};

let runtimeSettings: DashboardSettings = {
  ...DEFAULT_SETTINGS,
  fundMappings: [...DEFAULT_FUND_MAPPINGS],
  proxyDefinitions: [...DEFAULT_PROXY_DEFINITIONS],
};

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalise(value: unknown): string { return String(value ?? "").toUpperCase().replace(/\s+/g, " ").trim(); }
function trend(move: number | null): TrendState { return move === null ? "SIDEWAYS" : move >= 0.45 ? "UP" : move <= -0.7 ? "DOWN" : "SIDEWAYS"; }
function validMove(move: number | null, sector: boolean): number | null {
  if (move === null || !Number.isFinite(move)) return null;
  const limit = sector ? 7 : 10;
  return Math.abs(move) <= limit ? move : null;
}
function emptyQuote(item: TrackedIndex): IndexQuote {
  return { key: item.key, name: item.name, value: null, change: null, changePct: null, fiveDayPct: null, oneMonthPct: null, threeMonthPct: null, fiftyTwoWeekPct: null, sma20: null, sma50: null, sma200: null, trend: "SIDEWAYS", isSector: item.isSector };
}

function executionWindow() {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const weekday = get("weekday"), hour = Number(get("hour")), minute = Number(get("minute")), second = Number(get("second"));
  const minutes = hour * 60 + minute + second / 60, open = 555, close = 900;
  if (weekday === "Sat" || weekday === "Sun") return { cutoffProgressPct: 0, cutoffLabel: "Market closed • Weekend • Next trading session required", open: false, passed: true };
  if (minutes < open) return { cutoffProgressPct: 0, cutoffLabel: "Market closed • Opens at 9:15 AM IST", open: false, passed: false };
  if (minutes >= close) return { cutoffProgressPct: 100, cutoffLabel: "3:00 PM cut-off passed • Next-session NAV window", open: false, passed: true };
  const remaining = close - minutes;
  return { cutoffProgressPct: ((minutes - open) / (close - open)) * 100, cutoffLabel: `Same-day NAV window open • ${Math.floor(remaining / 60)}h ${Math.floor(remaining % 60)}m to 3:00 PM cut-off`, open: true, passed: false };
}

function quoteFromNse(item: TrackedIndex, row: IndexRow, warnings: string[]): IndexQuote {
  const last = num(row.last);
  const previousClose = num(row.previousClose);
  const variation = num(row.variation);
  // IMPORTANT: never trust NSE's percentChange field for scoring. Recalculate it from
  // last/previousClose (or variation/previousClose). This prevents a stale/mismatched
  // percentage from creating a false sector signal, especially for NIFTY Realty.
  const calculated = last !== null && previousClose !== null && previousClose !== 0
    ? ((last - previousClose) / previousClose) * 100
    : variation !== null && previousClose !== null && previousClose !== 0 ? (variation / previousClose) * 100 : null;
  const changePct = validMove(calculated, item.isSector);
  if (calculated !== null && changePct === null) warnings.push(`${item.name} rejected abnormal calculated move ${calculated.toFixed(2)}%`);
  return {
    key: item.key, name: item.name, value: last, change: variation ?? (last !== null && previousClose !== null ? last - previousClose : null), changePct,
    fiveDayPct: null, oneMonthPct: num(row.perChange30d), threeMonthPct: num(row.perChange90d), fiftyTwoWeekPct: num(row.perChange365d),
    sma20: null, sma50: null, sma200: null, trend: trend(changePct), isSector: item.isSector,
  };
}

async function fetchNse(): Promise<{ quotes: IndexQuote[]; warning?: string }> {
  const warm = await fetch("https://www.nseindia.com", { cache: "no-store", headers: { "user-agent": "Mozilla/5.0", accept: "text/html,application/xhtml+xml" } });
  if (!warm.ok) throw new Error("NSE warm-up failed");
  const response = await fetch("https://www.nseindia.com/api/allIndices", { cache: "no-store", headers: { "user-agent": "Mozilla/5.0", accept: "application/json,text/plain,*/*", referer: "https://www.nseindia.com/" } });
  if (!response.ok) throw new Error("NSE allIndices failed");
  const json = (await response.json()) as { data?: IndexRow[] };
  if (!Array.isArray(json.data) || !json.data.length) throw new Error("NSE returned no index rows");
  const warnings: string[] = [];
  const quotes = TRACKED.map((item) => {
    const wanted = item.aliases.map(normalise);
    const row = json.data!.find((candidate) => wanted.includes(normalise(candidate.index)));
    return row ? quoteFromNse(item, row, warnings) : emptyQuote(item);
  });
  return { quotes, warning: warnings.length ? `NSE validation: ${warnings.join(" • ")}` : undefined };
}

async function fetchYahoo(): Promise<{ quotes: IndexQuote[]; warning: string }> {
  const results = await Promise.all(TRACKED.map(async (item) => {
    const symbol = YAHOO_SYMBOLS[item.key];
    if (!symbol) return emptyQuote(item);
    try {
      const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d`, { cache: "no-store", headers: { accept: "application/json" } });
      if (!response.ok) return emptyQuote(item);
      const json = (await response.json()) as YahooChart;
      const result = json.chart?.result?.[0];
      const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      if (!result || closes.length < 2) return emptyQuote(item);
      const value = num(result.meta?.regularMarketPrice) ?? closes[closes.length - 1];
      const previous = num(result.meta?.previousClose) ?? closes[closes.length - 2];
      const raw = value !== null && previous !== null && previous !== 0 ? ((value - previous) / previous) * 100 : null;
      return { ...emptyQuote(item), value, change: value !== null && previous !== null ? value - previous : null, changePct: validMove(raw, item.isSector), trend: trend(validMove(raw, item.isSector)) };
    } catch { return emptyQuote(item); }
  }));
  return { quotes: results, warning: "NSE feed unavailable; Yahoo Finance fallback used and values are suppressed if validation fails." };
}

async function fetchIndices() {
  try { return await fetchNse(); } catch { return fetchYahoo(); }
}

async function fetchAmfiNavs(funds: FundMapping[]): Promise<{ navs: Map<string, NavRow>; warning?: string }> {
  const map = new Map<string, NavRow>();
  try {
    const response = await fetch("https://portal.amfiindia.com/spages/NAVAll.txt", { cache: "no-store", headers: { accept: "text/plain" } });
    if (!response.ok) return { navs: map, warning: "AMFI NAV feed unavailable." };
    const rows = (await response.text()).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.split(";"));
    for (const fund of funds) {
      let candidates = fund.amfiCode ? rows.filter((r) => r.length >= 6 && normalise(r[0]) === normalise(fund.amfiCode)) : [];
      if (!candidates.length) {
        const term = normalise(fund.amfiSearchTerm ?? fund.name);
        candidates = rows.filter((r) => r.length >= 6 && normalise(r[3]).includes(term));
      }
      const preferred = candidates.find((r) => /DIRECT/i.test(r[3]) && /GROWTH/i.test(r[3]) && !/IDCW|DIVIDEND|BONUS/i.test(r[3]))
        ?? candidates.find((r) => /GROWTH/i.test(r[3]) && !/IDCW|DIVIDEND|BONUS/i.test(r[3])) ?? candidates[0];
      const nav = preferred ? num(preferred[4]) : null;
      if (preferred && nav !== null && nav > 0) map.set(fund.id, { code: String(preferred[0]), name: String(preferred[3]), nav, date: String(preferred[5]) });
    }
    return { navs: map };
  } catch { return { navs: map, warning: "AMFI NAV feed could not be read." }; }
}

function sensitivityFor(fund: FundMapping): number {
  if (fund.id === "tata-digital") return 0.82;
  if (["NIFTY_50", "NIFTY_NEXT_50", "MIDCAP_150", "SMALLCAP_250", "LARGEMIDCAP_250"].includes(fund.proxyKey)) return 0.72;
  if (["NIFTY_IT", "NIFTY_PHARMA", "NIFTY_FIN_SERVICE", "BANK_NIFTY", "NIFTY_AUTO", "NIFTY_FMCG", "NIFTY_METAL", "NIFTY_REALTY", "NIFTY_INFRA", "NIFTY_SERVICES"].includes(fund.proxyKey)) return 0.78;
  return 0.60;
}

function scoreFunds(indices: IndexQuote[], funds: FundMapping[], navs: Map<string, NavRow>): ScoredFund[] {
  const byKey = new Map(indices.map((i) => [i.key, i]));
  const nifty = byKey.get("NIFTY_50")?.changePct ?? null;
  return funds.map((fund) => {
    const definition = runtimeSettings.proxyDefinitions.find((p) => p.key === fund.proxyKey);
    const proxy = byKey.get(definition?.indexKey ?? fund.proxyKey);
    const move = proxy?.changePct ?? null;
    const nav = navs.get(fund.id);
    const sensitivity = sensitivityFor(fund);
    const usable = move !== null && nav !== undefined;
    const impact = usable ? move * sensitivity : null;
    const estimatedNav = usable ? nav!.nav * (1 + impact! / 100) : null;
    const strategic = Math.round(Math.max(25, Math.min(90, 50 + (proxy?.oneMonthPct ?? 0) * 1.8)) * 10) / 10;
    const opportunity = move === null ? 0 : Math.round(Math.max(20, Math.min(95, 50 - move * 8 + (move < -0.35 ? 7 : 0) + (move > 0.5 ? -6 : 0))) * 10) / 10;
    const classification: FundClassification = !usable ? "NEUTRAL" : move <= -1.5 ? "STRUCTURAL_BREAKDOWN" : move < -0.25 ? "HEALTHY_CORRECTION" : "NEUTRAL";
    const navScore = usable && move < 0 ? Math.round(Math.max(0, Math.min(100, 35 + Math.abs(impact!) * 28 + (classification === "HEALTHY_CORRECTION" ? 18 : 0) + (strategic >= 55 ? 12 : 0)))) : 0;
    const label = navScore >= 70 ? "HIGH" : navScore >= 48 ? "MEDIUM" : navScore > 0 ? "LOW" : "NONE";
    const finalScore = Math.round((strategic * runtimeSettings.strategicWeight / 100 + opportunity * runtimeSettings.opportunityWeight / 100) * 10) / 10;
    const actionTag: FundActionTag = !usable ? "WAIT" : classification === "STRUCTURAL_BREAKDOWN" ? "AVOID TODAY" : finalScore >= 60 ? "BUY ON DIP" : finalScore >= 48 ? "SIP" : "WAIT";
    const clock = executionWindow();
    const executionSignal = !usable ? "WAIT — LIVE MARKET/NAV DATA NOT VERIFIED" : classification === "STRUCTURAL_BREAKDOWN" ? "AVOID — STRUCTURAL WEAKNESS" : move < -0.25 ? clock.open ? "ELIGIBLE WINDOW: BUY BEFORE 3 PM, SUBJECT TO FUNDS REALISATION" : "NEXT SESSION: RECHECK WEAKNESS BEFORE BUYING" : move >= 0.5 ? "AVOID CHASING STRENGTH" : "WAIT FOR A BETTER ENTRY";
    const relative = move !== null && nifty !== null ? move - nifty : null;
    return {
      id: fund.id, name: fund.name, proxyKey: fund.proxyKey, proxyLabel: definition?.label ?? fund.proxyKey, proxyMovePct: move,
      strategicScore: strategic, opportunityScore: opportunity, finalScore, trend: proxy?.trend ?? "SIDEWAYS", classification, actionTag,
      executionSignal, confidence: !usable ? "UNVERIFIED" : Math.abs(move) >= 1 ? "HIGH" : Math.abs(move) >= 0.4 ? "MEDIUM" : "LOW",
      reason: move === null ? `${definition?.label ?? fund.proxyKey} market data is not currently verified.` : `${definition?.label ?? fund.proxyKey} moved ${move >= 0 ? "+" : ""}${move.toFixed(2)}% today. Modelled fund impact uses ${Math.round(sensitivity * 100)}% proxy sensitivity.`,
      expectedNavImpactNote: nav ? `Latest published NAV ₹${nav.nav.toFixed(4)} • ${nav.date} • modelled closing NAV ₹${estimatedNav?.toFixed(4) ?? "—"}.` : "NAV unavailable from AMFI; tactical signal suppressed.",
      technical: { latestNav: nav?.nav ?? null, navDate: nav?.date ?? null, estimatedNav, estimatedNavChangePct: impact, navOpportunityScore: navScore, navOpportunityLabel: label, return1M: proxy?.oneMonthPct ?? null, return3M: proxy?.threeMonthPct ?? null, return6M: null, momentum10D: move, momentum20D: null, momentum50D: null, sma20: null, sma50: null, sma100: null, sma200: null, drawdown52W: null, drawdownAllTime: null, relStrengthVsNifty20D: relative, relStrengthVsNifty50D: relative },
    };
  }).sort((a, b) => b.finalScore - a.finalScore);
}

export function getOrCreateSettings(): DashboardSettings { return runtimeSettings; }
export function updateSettings(patch: Partial<DashboardSettings>): DashboardSettings {
  runtimeSettings = { ...runtimeSettings, ...(patch.marketDataProvider ? { marketDataProvider: patch.marketDataProvider } : {}), ...(typeof patch.strategicWeight === "number" ? { strategicWeight: patch.strategicWeight } : {}), ...(typeof patch.opportunityWeight === "number" ? { opportunityWeight: patch.opportunityWeight } : {}), ...(patch.tacticalTopupAmount !== undefined ? { tacticalTopupAmount: patch.tacticalTopupAmount } : {}), ...(patch.fundMappings ? { fundMappings: patch.fundMappings } : {}), ...(patch.proxyDefinitions ? { proxyDefinitions: patch.proxyDefinitions } : {}) };
  return runtimeSettings;
}

async function buildLiveSnapshot(): Promise<DashboardSnapshot> {
  const market = await fetchIndices();
  const navResult = await fetchAmfiNavs(runtimeSettings.fundMappings);
  const scored = scoreFunds(market.quotes, runtimeSettings.fundMappings, navResult.navs);
  const sectors = market.quotes.filter((i) => i.isSector && i.changePct !== null);
  const falling = [...sectors].filter((i) => i.changePct! < 0).sort((a, b) => a.changePct! - b.changePct!).slice(0, 5);
  const strongest = [...sectors].filter((i) => i.changePct! > 0).sort((a, b) => b.changePct! - a.changePct!).slice(0, 5);
  const positive = sectors.filter((i) => i.changePct! > 0).length;
  const breadth = sectors.length ? positive / sectors.length * 100 : 0;
  const average = sectors.length ? sectors.reduce((s, i) => s + i.changePct!, 0) / sectors.length : 0;
  const lowerNav = scored.filter((f) => f.technical.navOpportunityScore > 0 && f.actionTag !== "WAIT" && f.actionTag !== "AVOID TODAY").sort((a, b) => b.technical.navOpportunityScore - a.technical.navOpportunityScore);
  const clock = executionWindow();
  const warnings = [market.warning, navResult.warning].filter((v): v is string => Boolean(v));
  if (navResult.navs.size < runtimeSettings.fundMappings.length) warnings.push(`AMFI returned verified NAVs for ${navResult.navs.size} of ${runtimeSettings.fundMappings.length} configured funds.`);
  return {
    generatedAt: new Date().toISOString(), dataFreshnessNote: warnings.length ? "Live refresh with source validation" : "Live NSE market and AMFI NAV snapshot validated", sourceWarnings: warnings,
    settings: runtimeSettings, regime: { badge: sectors.length && breadth >= 55 && average >= 0 ? "RISK_ON" : "RISK_OFF", label: sectors.length && breadth >= 55 && average >= 0 ? "🟢 RISK ON" : "🔴 RISK OFF", strategyNote: sectors.length && breadth >= 55 && average >= 0 ? "Maintain core SIP and selectively add on meaningful corrections." : "Core SIP can continue; focus tactical buying on healthy corrections and avoid chasing strength.", breadthPositivePct: breadth },
    headlineIndices: market.quotes.filter((i) => ["NIFTY_50", "SENSEX", "MIDCAP_150", "SMALLCAP_250", "NIFTY_NEXT_50", "BANK_NIFTY", "NIFTY_IT", "NIFTY_PHARMA"].includes(i.key)),
    fallingIndices: falling, strongestIndices: strongest, topFunds: scored.filter((f) => f.actionTag !== "WAIT").slice(0, 5), avoidFunds: scored.filter((f) => f.classification === "STRUCTURAL_BREAKDOWN"), allFunds: scored, lowerNavOpportunities: lowerNav, sectorHeatmap: market.quotes.filter((i) => i.isSector), indexTable: market.quotes,
    tacticalAllocation: lowerNav.slice(0, 5).map((f, index) => ({ fundId: f.id, fundName: f.name, amount: 0, scoreWeight: Math.max(0, 100 - index * 12) })), cutoffProgressPct: clock.cutoffProgressPct, cutoffLabel: clock.cutoffLabel, disclaimers: DASHBOARD_DISCLAIMERS,
  };
}

export function buildFallbackSnapshot(): DashboardSnapshot {
  const indices = TRACKED.map(emptyQuote), clock = executionWindow();
  return { generatedAt: new Date().toISOString(), dataFreshnessNote: "Live data unavailable — tactical recommendations suppressed", sourceWarnings: ["Live market/NAV feeds are unavailable or failed validation. No stale market values are being substituted."], settings: runtimeSettings, regime: { badge: "RISK_OFF", label: "🔴 DATA UNVERIFIED", strategyNote: "Do not use tactical BUY signals until live market and NAV data are verified.", breadthPositivePct: 0 }, headlineIndices: indices.filter((i) => ["NIFTY_50", "SENSEX", "MIDCAP_150", "SMALLCAP_250", "NIFTY_NEXT_50", "BANK_NIFTY", "NIFTY_IT", "NIFTY_PHARMA"].includes(i.key)), fallingIndices: [], strongestIndices: [], topFunds: [], avoidFunds: [], allFunds: [], lowerNavOpportunities: [], sectorHeatmap: indices.filter((i) => i.isSector), indexTable: indices, tacticalAllocation: [], cutoffProgressPct: clock.cutoffProgressPct, cutoffLabel: clock.cutoffLabel, disclaimers: DASHBOARD_DISCLAIMERS };
}
export async function generateDashboardSnapshot(): Promise<DashboardSnapshot> { return buildLiveSnapshot(); }
export async function getOrBuildInitialSnapshot(): Promise<DashboardSnapshot> { return buildLiveSnapshot(); }
