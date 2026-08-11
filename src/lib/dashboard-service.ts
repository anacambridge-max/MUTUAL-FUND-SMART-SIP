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

type NavRow = { code: string; name: string; nav: number; date: string };

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; previousClose?: number };
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

type TrackedIndex = { key: string; name: string; aliases: string[]; isSector: boolean };

const TRACKED: TrackedIndex[] = [
  { key: "NIFTY_50", name: "NIFTY 50", aliases: ["NIFTY 50", "NIFTY50"], isSector: false },
  { key: "SENSEX", name: "SENSEX", aliases: ["S&P BSE SENSEX", "SENSEX"], isSector: false },
  { key: "MIDCAP_150", name: "NIFTY Midcap 150", aliases: ["NIFTY MIDCAP 150", "NIFTY MIDCAP150"], isSector: false },
  { key: "SMALLCAP_250", name: "NIFTY Smallcap 250", aliases: ["NIFTY SMALLCAP 250", "NIFTY SMALLCAP250"], isSector: false },
  { key: "NIFTY_NEXT_50", name: "NIFTY Next 50", aliases: ["NIFTY NEXT 50", "NIFTY NEXT50"], isSector: false },
  { key: "LARGEMIDCAP_250", name: "NIFTY LargeMidcap 250", aliases: ["NIFTY LARGEMIDCAP 250"], isSector: false },
  { key: "BANK_NIFTY", name: "NIFTY Bank", aliases: ["NIFTY BANK", "BANKNIFTY"], isSector: true },
  { key: "NIFTY_IT", name: "NIFTY IT", aliases: ["NIFTY IT"], isSector: true },
  { key: "NIFTY_AUTO", name: "NIFTY Auto", aliases: ["NIFTY AUTO"], isSector: true },
  { key: "NIFTY_PHARMA", name: "NIFTY Pharma", aliases: ["NIFTY PHARMA"], isSector: true },
  { key: "NIFTY_FMCG", name: "NIFTY FMCG", aliases: ["NIFTY FMCG"], isSector: true },
  { key: "NIFTY_METAL", name: "NIFTY Metal", aliases: ["NIFTY METAL"], isSector: true },
  { key: "NIFTY_REALTY", name: "NIFTY Realty", aliases: ["NIFTY REALTY"], isSector: true },
  { key: "NIFTY_FIN_SERVICE", name: "NIFTY Financial Services", aliases: ["NIFTY FINANCIAL SERVICES", "NIFTY FIN SERVICE"], isSector: true },
  { key: "NIFTY_ENERGY", name: "NIFTY Energy", aliases: ["NIFTY ENERGY"], isSector: true },
  { key: "NIFTY_PSU_BANK", name: "NIFTY PSU Bank", aliases: ["NIFTY PSU BANK"], isSector: true },
  { key: "NIFTY_INFRA", name: "NIFTY Infrastructure", aliases: ["NIFTY INFRASTRUCTURE"], isSector: true },
  { key: "NIFTY_SERVICES", name: "NIFTY Services Sector", aliases: ["NIFTY SERVICES SECTOR"], isSector: true },
  { key: "GOLD_PROXY", name: "Gold Proxy", aliases: ["GOLD"], isSector: false },
];

const YAHOO_SYMBOLS: Record<string, string> = {
  NIFTY_50: "%5ENSEI",
  SENSEX: "%5EBSESN",
  MIDCAP_150: "NIFTYMIDCAP150.NS",
  SMALLCAP_250: "NIFTYSMLCAP250.NS",
  NIFTY_NEXT_50: "NIFTYNXT50.NS",
  LARGEMIDCAP_250: "NIFTY_LARGEMID250.NS",
  BANK_NIFTY: "%5ENSEBANK",
  NIFTY_IT: "%5ECNXIT",
  NIFTY_AUTO: "%5ECNXAUTO",
  NIFTY_PHARMA: "%5ECNXPHARMA",
  NIFTY_FMCG: "%5ECNXFMCG",
  NIFTY_METAL: "%5ECNXMETAL",
  NIFTY_REALTY: "%5ECNXREALTY",
  NIFTY_FIN_SERVICE: "NIFTYFINSERVICE.NS",
  NIFTY_ENERGY: "NIFTYENERGY.NS",
  NIFTY_PSU_BANK: "NIFTYPSUBANK.NS",
  NIFTY_INFRA: "NIFTYINFRA.NS",
  NIFTY_SERVICES: "NIFTYSERVICES.NS",
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

function trend(move: number | null): TrendState {
  if (move === null) return "SIDEWAYS";
  if (move >= 0.45) return "UP";
  if (move <= -0.70) return "DOWN";
  return "SIDEWAYS";
}

function validMove(move: number | null, isSector: boolean): number | null {
  if (move === null || !Number.isFinite(move)) return null;
  // A single corrupted feed value must never create a false tactical signal.
  // Sector indices are rejected above +/-5%; broad indices above +/-8%.
  const limit = isSector ? 5 : 8;
  return Math.abs(move) <= limit ? move : null;
}

function emptyQuote(item: TrackedIndex): IndexQuote {
  return {
    key: item.key,
    name: item.name,
    value: null,
    change: null,
    changePct: null,
    fiveDayPct: null,
    oneMonthPct: null,
    threeMonthPct: null,
    fiftyTwoWeekPct: null,
    sma20: null,
    sma50: null,
    sma200: null,
    trend: "SIDEWAYS",
    isSector: item.isSector,
  };
}

function executionWindow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekday = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const second = Number(get("second"));
  const minutes = hour * 60 + minute + second / 60;
  const open = 9 * 60 + 15;
  const close = 15 * 60;
  const weekend = weekday === "Sat" || weekday === "Sun";

  if (weekend) {
    return { cutoffProgressPct: 0, cutoffLabel: "Market closed • Weekend • Next trading session required", open: false, passed: true };
  }
  if (minutes < open) {
    return { cutoffProgressPct: 0, cutoffLabel: "Market closed • Opens at 9:15 AM IST", open: false, passed: false };
  }
  if (minutes >= close) {
    return { cutoffProgressPct: 100, cutoffLabel: "3:00 PM cut-off passed • Next-session NAV window", open: false, passed: true };
  }
  const progress = ((minutes - open) / (close - open)) * 100;
  const remaining = Math.max(0, close - minutes);
  const hours = Math.floor(remaining / 60);
  const mins = Math.floor(remaining % 60);
  return {
    cutoffProgressPct: progress,
    cutoffLabel: `Same-day NAV window open • ${hours}h ${mins}m to 3:00 PM cut-off`,
    open: true,
    passed: false,
  };
}

async function fetchYahoo(): Promise<{ quotes: IndexQuote[]; warning?: string }> {
  const warnings: string[] = [];
  const results = await Promise.all(
    TRACKED.map(async (item) => {
      const symbol = YAHOO_SYMBOLS[item.key];
      if (!symbol) return emptyQuote(item);
      try {
        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!response.ok) return emptyQuote(item);
        const json = (await response.json()) as YahooChart;
        const result = json.chart?.result?.[0];
        const rawCloses = result?.indicators?.quote?.[0]?.close ?? [];
        const closes = rawCloses.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        if (!result || closes.length === 0) return emptyQuote(item);

        const value = num(result.meta?.regularMarketPrice) ?? closes[closes.length - 1] ?? null;
        const previous = num(result.meta?.previousClose) ?? (closes.length > 1 ? closes[closes.length - 2] : null);
        const rawMove = value !== null && previous !== null && previous !== 0 ? ((value - previous) / previous) * 100 : null;
        const changePct = validMove(rawMove, item.isSector);
        if (rawMove !== null && changePct === null) warnings.push(`${item.name} rejected abnormal move ${rawMove.toFixed(2)}%`);
        const returnOver = (days: number): number | null => {
          if (closes.length <= days) return null;
          const base = closes[closes.length - days - 1];
          return base ? ((closes[closes.length - 1] / base) - 1) * 100 : null;
        };
        const average = (days: number): number | null => {
          if (closes.length < days) return null;
          return closes.slice(-days).reduce((sum, close) => sum + close, 0) / days;
        };
        return {
          key: item.key,
          name: item.name,
          value,
          change: value !== null && previous !== null ? value - previous : null,
          changePct,
          fiveDayPct: returnOver(5),
          oneMonthPct: returnOver(21),
          threeMonthPct: returnOver(63),
          fiftyTwoWeekPct: returnOver(252),
          sma20: average(20),
          sma50: average(50),
          sma200: average(200),
          trend: trend(changePct),
          isSector: item.isSector,
        } satisfies IndexQuote;
      } catch {
        return emptyQuote(item);
      }
    }),
  );
  return {
    quotes: results,
    warning: `NSE feed unavailable; validated Yahoo Finance fallback used.${warnings.length ? ` ${warnings.join(" • ")}` : ""}`,
  };
}

async function fetchIndices(): Promise<{ quotes: IndexQuote[]; warning?: string }> {
  try {
    const warm = await fetch("https://www.nseindia.com", {
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
        referer: "https://www.nseindia.com/",
      },
    });
    if (!warm.ok) throw new Error("NSE warm-up failed");
    const response = await fetch("https://www.nseindia.com/api/allIndices", {
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        accept: "application/json,text/plain,*/*",
        referer: "https://www.nseindia.com/",
      },
    });
    if (!response.ok) throw new Error("NSE indices request failed");
    const json = (await response.json()) as { data?: Array<Record<string, unknown>> };
    const rows = Array.isArray(json.data) ? json.data : [];
    if (!rows.length) throw new Error("NSE returned no index rows");

    const warnings: string[] = [];
    const quotes = TRACKED.map((item) => {
      const row = rows.find((candidate) => item.aliases.some((alias) => String(candidate.index ?? "").toUpperCase().trim() === alias.toUpperCase().trim()));
      if (!row) return emptyQuote(item);
      const rawMove = num(row.percentChange);
      const changePct = validMove(rawMove, item.isSector);
      if (rawMove !== null && changePct === null) warnings.push(`${item.name} rejected abnormal move ${rawMove.toFixed(2)}%`);
      return {
        key: item.key,
        name: item.name,
        value: num(row.last),
        change: num(row.variation),
        changePct,
        fiveDayPct: null,
        oneMonthPct: num(row.perChange30d),
        threeMonthPct: num(row.perChange90d),
        fiftyTwoWeekPct: num(row.perChange365d),
        sma20: null,
        sma50: null,
        sma200: null,
        trend: trend(changePct),
        isSector: item.isSector,
      } satisfies IndexQuote;
    });
    return { quotes, warning: warnings.length ? `Market data validation excluded: ${warnings.join(" • ")}` : undefined };
  } catch {
    return fetchYahoo();
  }
}

async function fetchAmfiNavs(funds: FundMapping[]): Promise<{ navs: Map<string, NavRow>; warning?: string }> {
  const map = new Map<string, NavRow>();
  try {
    const response = await fetch("https://portal.amfiindia.com/spages/NAVAll.txt", {
      cache: "no-store",
      headers: { accept: "text/plain" },
    });
    if (!response.ok) return { navs: map, warning: "AMFI NAV feed unavailable." };
    const lines = (await response.text()).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const rows = lines.map((line) => line.split(";"));

    for (const fund of funds) {
      let candidates = fund.amfiCode ? rows.filter((row) => row.length >= 6 && String(row[0]).trim() === fund.amfiCode) : [];
      if (!candidates.length) {
        const search = (fund.amfiSearchTerm ?? fund.name).toUpperCase();
        candidates = rows.filter((row) => row.length >= 6 && row[3] && String(row[3]).toUpperCase().includes(search));
      }
      const preferred =
        candidates.find((row) => /DIRECT/i.test(String(row[3])) && /GROWTH/i.test(String(row[3])) && !/IDCW|DIVIDEND|BONUS/i.test(String(row[3]))) ??
        candidates.find((row) => /GROWTH/i.test(String(row[3])) && !/IDCW|DIVIDEND|BONUS/i.test(String(row[3]))) ??
        candidates[0];
      if (!preferred) continue;
      const nav = num(preferred[4]);
      if (nav !== null && nav > 0) {
        map.set(fund.id, { code: String(preferred[0]), name: String(preferred[3]), nav, date: String(preferred[5]) });
      }
    }
    return { navs: map, warning: undefined };
  } catch {
    return { navs: map, warning: "AMFI NAV feed could not be read." };
  }
}

function sensitivityFor(fund: FundMapping): number {
  if (fund.id === "tata-digital") return 0.82;
  if (["NIFTY_50", "NIFTY_NEXT_50", "MIDCAP_150", "SMALLCAP_250", "LARGEMIDCAP_250"].includes(fund.proxyKey)) return 0.72;
  if (["NIFTY_IT", "NIFTY_PHARMA", "NIFTY_FIN_SERVICE", "BANK_NIFTY", "NIFTY_AUTO", "NIFTY_FMCG", "NIFTY_METAL", "NIFTY_REALTY", "NIFTY_INFRA", "NIFTY_SERVICES"].includes(fund.proxyKey)) return 0.78;
  return 0.60;
}

function scoreFunds(indices: IndexQuote[], funds: FundMapping[], navs: Map<string, NavRow>): ScoredFund[] {
  const byKey = new Map(indices.map((index) => [index.key, index]));
  const niftyMove = byKey.get("NIFTY_50")?.changePct ?? null;
  return funds.map((fund) => {
    const proxyDefinition = runtimeSettings.proxyDefinitions.find((item) => item.key === fund.proxyKey);
    const proxy = byKey.get(proxyDefinition?.indexKey ?? fund.proxyKey);
    const move = proxy?.changePct ?? null;
    const sensitivity = sensitivityFor(fund);
    const nav = navs.get(fund.id);
    const usable = move !== null && nav !== undefined;
    const estimatedImpact = usable ? move * sensitivity : null;
    const estimatedNav = usable ? nav.nav * (1 + (estimatedImpact as number) / 100) : null;

    const strategicBase = proxy?.oneMonthPct ?? null;
    const strategic = Math.round(Math.max(25, Math.min(90, 50 + (strategicBase ?? 0) * 1.8)) * 10) / 10;
    const opportunity = move === null ? 0 : Math.round(Math.max(20, Math.min(95, 50 - move * 8 + (move < -0.35 ? 7 : 0) + (move > 0.5 ? -6 : 0))) * 10) / 10;
    const classification: FundClassification = !usable ? "NEUTRAL" : move <= -1.5 ? "STRUCTURAL_BREAKDOWN" : move < -0.25 ? "HEALTHY_CORRECTION" : "NEUTRAL";
    const navOpportunityScore = usable && move < 0
      ? Math.round(Math.max(0, Math.min(100, 35 + Math.abs(estimatedImpact as number) * 28 + (classification === "HEALTHY_CORRECTION" ? 18 : 0) + (strategic >= 55 ? 12 : 0))))
      : 0;
    const navOpportunityLabel = navOpportunityScore >= 70 ? "HIGH" : navOpportunityScore >= 48 ? "MEDIUM" : navOpportunityScore > 0 ? "LOW" : "NONE";
    const finalScore = Math.round((strategic * runtimeSettings.strategicWeight / 100 + opportunity * runtimeSettings.opportunityWeight / 100) * 10) / 10;
    const actionTag: FundActionTag = !usable ? "WAIT" : classification === "STRUCTURAL_BREAKDOWN" ? "AVOID TODAY" : finalScore >= 60 ? "BUY ON DIP" : finalScore >= 48 ? "SIP" : "WAIT";
    const confidence = !usable ? "UNVERIFIED" : Math.abs(move) >= 1 ? "HIGH" : Math.abs(move) >= 0.4 ? "MEDIUM" : "LOW";
    const clock = executionWindow();
    const executionSignal = !usable
      ? "WAIT — LIVE MARKET/NAV DATA NOT VERIFIED"
      : classification === "STRUCTURAL_BREAKDOWN"
        ? "AVOID — STRUCTURAL WEAKNESS"
        : move < -0.25
          ? clock.open
            ? "ELIGIBLE WINDOW: BUY BEFORE 3 PM, SUBJECT TO FUNDS REALISATION"
            : clock.passed
              ? "NEXT SESSION: RECHECK WEAKNESS BEFORE BUYING"
              : "NEXT SESSION: REVIEW AT MARKET OPEN"
          : move >= 0.5
            ? "AVOID CHASING STRENGTH"
            : "WAIT FOR A BETTER ENTRY";
    const relativeStrength = move !== null && niftyMove !== null ? move - niftyMove : null;

    return {
      id: fund.id,
      name: fund.name,
      proxyKey: fund.proxyKey,
      proxyLabel: proxyDefinition?.label ?? fund.proxyKey,
      proxyMovePct: move,
      strategicScore: strategic,
      opportunityScore: opportunity,
      finalScore,
      trend: proxy?.trend ?? "SIDEWAYS",
      classification,
      actionTag,
      executionSignal,
      confidence,
      reason: move === null
        ? `${proxyDefinition?.label ?? fund.proxyKey} market data is not currently verified.`
        : `${proxyDefinition?.label ?? fund.proxyKey} moved ${move >= 0 ? "+" : ""}${move.toFixed(2)}% today. Modelled fund impact uses ${Math.round(sensitivity * 100)}% proxy sensitivity.` ,
      expectedNavImpactNote: nav
        ? `Latest published NAV ₹${nav.nav.toFixed(4)} • ${nav.date} • modelled closing NAV ₹${estimatedNav?.toFixed(4) ?? "—"}.`
        : "NAV unavailable from the AMFI daily feed; tactical signal suppressed.",
      technical: {
        latestNav: nav?.nav ?? null,
        navDate: nav?.date ?? null,
        estimatedNav,
        estimatedNavChangePct: estimatedImpact,
        navOpportunityScore,
        navOpportunityLabel,
        return1M: proxy?.oneMonthPct ?? null,
        return3M: proxy?.threeMonthPct ?? null,
        return6M: null,
        momentum10D: move,
        momentum20D: null,
        momentum50D: null,
        sma20: proxy?.sma20 ?? null,
        sma50: proxy?.sma50 ?? null,
        sma100: null,
        sma200: proxy?.sma200 ?? null,
        drawdown52W: null,
        drawdownAllTime: null,
        relStrengthVsNifty20D: relativeStrength,
        relStrengthVsNifty50D: relativeStrength,
      },
    };
  }).sort((a, b) => b.finalScore - a.finalScore);
}

export function getOrCreateSettings(): DashboardSettings {
  return runtimeSettings;
}

export function updateSettings(patch: Partial<DashboardSettings>): DashboardSettings {
  runtimeSettings = {
    ...runtimeSettings,
    ...(patch.marketDataProvider ? { marketDataProvider: patch.marketDataProvider } : {}),
    ...(typeof patch.strategicWeight === "number" ? { strategicWeight: patch.strategicWeight } : {}),
    ...(typeof patch.opportunityWeight === "number" ? { opportunityWeight: patch.opportunityWeight } : {}),
    ...(patch.tacticalTopupAmount !== undefined ? { tacticalTopupAmount: patch.tacticalTopupAmount } : {}),
    ...(patch.fundMappings ? { fundMappings: patch.fundMappings } : {}),
    ...(patch.proxyDefinitions ? { proxyDefinitions: patch.proxyDefinitions } : {}),
  };
  return runtimeSettings;
}

async function buildLiveSnapshot(): Promise<DashboardSnapshot> {
  const market = await fetchIndices();
  const navResult = await fetchAmfiNavs(runtimeSettings.fundMappings);
  const navs = navResult.navs;
  const scored = scoreFunds(market.quotes, runtimeSettings.fundMappings, navs);
  const sectors = market.quotes.filter((item) => item.isSector && item.changePct !== null);
  const falling = [...sectors].filter((item) => (item.changePct as number) < 0).sort((a, b) => (a.changePct as number) - (b.changePct as number)).slice(0, 5);
  const strongest = [...sectors].filter((item) => (item.changePct as number) > 0).sort((a, b) => (b.changePct as number) - (a.changePct as number)).slice(0, 5);
  const positive = sectors.filter((item) => (item.changePct as number) > 0).length;
  const breadth = sectors.length ? (positive / sectors.length) * 100 : 0;
  const average = sectors.length ? sectors.reduce((sum, item) => sum + (item.changePct as number), 0) / sectors.length : 0;
  const riskOn = sectors.length > 0 && breadth >= 55 && average >= 0;
  const clock = executionWindow();
  const warnings = [market.warning, navResult.warning].filter((warning): warning is string => Boolean(warning));
  if (navs.size < runtimeSettings.fundMappings.length) warnings.push(`AMFI returned verified NAVs for ${navs.size} of ${runtimeSettings.fundMappings.length} configured funds.`);
  const lowerNav = scored.filter((fund) => fund.technical.navOpportunityScore > 0 && fund.actionTag !== "WAIT" && fund.actionTag !== "AVOID TODAY").sort((a, b) => b.technical.navOpportunityScore - a.technical.navOpportunityScore);

  return {
    generatedAt: new Date().toISOString(),
    dataFreshnessNote: warnings.length ? "Live refresh with source validation and fallback protection" : "Live market and AMFI NAV snapshot validated",
    sourceWarnings: warnings,
    settings: runtimeSettings,
    regime: {
      badge: riskOn ? "RISK_ON" : "RISK_OFF",
      label: riskOn ? "🟢 RISK ON" : "🔴 RISK OFF",
      strategyNote: riskOn ? "Maintain core SIP and selectively add on meaningful corrections." : "Core SIP can continue; focus tactical buying on healthy corrections and avoid chasing strength.",
      breadthPositivePct: breadth,
    },
    headlineIndices: market.quotes.filter((item) => ["NIFTY_50", "SENSEX", "MIDCAP_150", "SMALLCAP_250", "NIFTY_NEXT_50", "BANK_NIFTY", "NIFTY_IT", "NIFTY_PHARMA"].includes(item.key)),
    fallingIndices: falling,
    strongestIndices: strongest,
    topFunds: scored.filter((fund) => fund.actionTag !== "WAIT").slice(0, 5),
    avoidFunds: scored.filter((fund) => fund.classification === "STRUCTURAL_BREAKDOWN"),
    allFunds: scored,
    lowerNavOpportunities: lowerNav,
    sectorHeatmap: market.quotes.filter((item) => item.isSector),
    indexTable: market.quotes,
    tacticalAllocation: lowerNav.slice(0, 5).map((fund, index) => ({ fundId: fund.id, fundName: fund.name, amount: 0, scoreWeight: Math.max(0, 100 - index * 12) })),
    cutoffProgressPct: clock.cutoffProgressPct,
    cutoffLabel: clock.cutoffLabel,
    disclaimers: DASHBOARD_DISCLAIMERS,
  };
}

export function buildFallbackSnapshot(): DashboardSnapshot {
  const indices = TRACKED.map(emptyQuote);
  const clock = executionWindow();
  return {
    generatedAt: new Date().toISOString(),
    dataFreshnessNote: "Live data unavailable — tactical recommendations suppressed",
    sourceWarnings: ["Live market/NAV feeds are unavailable or failed validation. No stale market values are being substituted."],
    settings: runtimeSettings,
    regime: { badge: "RISK_OFF", label: "🔴 DATA UNVERIFIED", strategyNote: "Do not use tactical BUY signals until live market and NAV data are verified.", breadthPositivePct: 0 },
    headlineIndices: indices.filter((item) => ["NIFTY_50", "SENSEX", "MIDCAP_150", "SMALLCAP_250", "NIFTY_NEXT_50", "BANK_NIFTY", "NIFTY_IT", "NIFTY_PHARMA"].includes(item.key)),
    fallingIndices: [],
    strongestIndices: [],
    topFunds: [],
    avoidFunds: [],
    allFunds: [],
    lowerNavOpportunities: [],
    sectorHeatmap: indices.filter((item) => item.isSector),
    indexTable: indices,
    tacticalAllocation: [],
    cutoffProgressPct: clock.cutoffProgressPct,
    cutoffLabel: clock.cutoffLabel,
    disclaimers: DASHBOARD_DISCLAIMERS,
  };
}

export async function generateDashboardSnapshot(): Promise<DashboardSnapshot> {
  return buildLiveSnapshot();
}

export async function getOrBuildInitialSnapshot(): Promise<DashboardSnapshot> {
  return buildLiveSnapshot();
}
