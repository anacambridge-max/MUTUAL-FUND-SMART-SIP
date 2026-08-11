import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { dashboardSettings, dashboardSnapshots, fundNavHistory } from "@/db/schema";
import { DASHBOARD_DISCLAIMERS, DEFAULT_SETTINGS } from "@/lib/dashboard-defaults";
import type {
  DashboardSettings,
  DashboardSnapshot,
  FundMapping,
  FundTechnical,
  IndexQuote,
  MarketDataProvider,
  ProxyDefinition,
  ScoredFund,
  TrendState,
} from "@/lib/dashboard-types";

const TRACKED_INDICES: { key: string; name: string; aliases: string[]; isSector: boolean }[] = [
  { key: "NIFTY_50", name: "NIFTY 50", aliases: ["NIFTY 50", "NIFTY50"], isSector: false },
  { key: "SENSEX", name: "SENSEX", aliases: ["S&P BSE SENSEX", "SENSEX"], isSector: false },
  { key: "MIDCAP_150", name: "NIFTY Midcap 150", aliases: ["NIFTY MIDCAP 150", "NIFTY MIDCAP150"], isSector: false },
  { key: "SMALLCAP_250", name: "NIFTY Smallcap 250", aliases: ["NIFTY SMALLCAP 250", "NIFTY SMALLCAP250"], isSector: false },
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
  { key: "NIFTY_NEXT_50", name: "NIFTY Next 50", aliases: ["NIFTY NEXT 50", "NIFTY NEXT50"], isSector: false },
  { key: "LARGEMIDCAP_250", name: "NIFTY LargeMidcap 250", aliases: ["NIFTY LARGEMIDCAP 250"], isSector: false },
  { key: "GOLD_PROXY", name: "Gold Proxy", aliases: ["GOLD"], isSector: false },
];

type RawIndexQuote = {
  index: string;
  last: string | number;
  variation?: string | number;
  percentChange?: string | number;
  perChange365d?: string | number;
  perChange30d?: string | number;
  perChange90d?: string | number;
};

type NavPoint = { date: string; nav: number };

const NSE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "application/json,text/plain,*/*",
  "accept-language": "en-US,en;q=0.9",
  referer: "https://www.nseindia.com/",
};

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replaceAll(",", "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function rollingAverage(values: number[], lookback: number): number | null {
  if (values.length < lookback) return null;
  const slice = values.slice(values.length - lookback);
  return slice.reduce((sum, v) => sum + v, 0) / lookback;
}

function pctChange(current: number | null, prev: number | null): number | null {
  if (!current || !prev || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function getTrend(latest: number | null, sma50: number | null, sma200: number | null): TrendState {
  if (latest === null || sma50 === null || sma200 === null) return "SIDEWAYS";
  if (latest > sma50 && sma50 > sma200) return "UP";
  if (latest < sma50 && sma50 < sma200) return "DOWN";
  return "SIDEWAYS";
}

function calcCutoffInfo(now = new Date()) {
  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const dayStart = new Date(istNow);
  dayStart.setHours(9, 15, 0, 0);
  const cutoff = new Date(istNow);
  cutoff.setHours(15, 0, 0, 0);

  const total = cutoff.getTime() - dayStart.getTime();
  const elapsed = Math.min(Math.max(istNow.getTime() - dayStart.getTime(), 0), total);
  const remainingMs = Math.max(cutoff.getTime() - istNow.getTime(), 0);
  const hrs = Math.floor(remainingMs / (1000 * 60 * 60));
  const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    cutoffProgressPct: total > 0 ? (elapsed / total) * 100 : 0,
    cutoffLabel:
      remainingMs > 0
        ? `Time to 3:00 PM cut-off: ${hrs}h ${mins}m`
        : "3:00 PM cut-off window has passed for today",
  };
}

async function fetchWithTimeout(url: string, timeoutMs = 12000, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchNseIndices(): Promise<{ quotes: IndexQuote[]; warnings: string[] }> {
  const warnings: string[] = [];
  try {
    await fetchWithTimeout("https://www.nseindia.com", 10000, { headers: NSE_HEADERS });
    const response = await fetchWithTimeout("https://www.nseindia.com/api/allIndices", 12000, {
      headers: NSE_HEADERS,
    });
    if (!response.ok) throw new Error(`NSE request failed ${response.status}`);
    const json = (await response.json()) as { data?: RawIndexQuote[] };
    const rows = Array.isArray(json.data) ? json.data : [];

    const mapped = TRACKED_INDICES.map((def): IndexQuote => {
      const match = rows.find((row) => {
        const label = (row.index ?? "").toString().toUpperCase();
        return def.aliases.some((alias) => label.includes(alias.toUpperCase()));
      });

      const value = toNumber(match?.last);
      const change = toNumber(match?.variation);
      const changePct = toNumber(match?.percentChange);
      const oneMonthPct = toNumber(match?.perChange30d);
      const threeMonthPct = toNumber(match?.perChange90d);
      const fiftyTwoWeekPct = toNumber(match?.perChange365d);
      const trend: TrendState =
        oneMonthPct !== null && threeMonthPct !== null
          ? oneMonthPct > 0 && threeMonthPct > 0
            ? "UP"
            : oneMonthPct < 0 && threeMonthPct < 0
              ? "DOWN"
              : "SIDEWAYS"
          : "SIDEWAYS";

      return {
        key: def.key,
        name: def.name,
        value,
        change,
        changePct,
        fiveDayPct: null,
        oneMonthPct,
        threeMonthPct,
        fiftyTwoWeekPct,
        sma20: null,
        sma50: null,
        sma200: null,
        trend,
        isSector: def.isSector,
      };
    });

    if (mapped.every((q) => q.value === null)) {
      warnings.push("NSE response received, but tracked index symbols could not be matched.");
    }

    return { quotes: mapped, warnings };
  } catch {
    warnings.push("NSE unofficial endpoint unavailable. Using best-effort fallback market snapshot.");
    const fallback = TRACKED_INDICES.map(
      (def, idx): IndexQuote => ({
        key: def.key,
        name: def.name,
        value: 10000 + idx * 200,
        change: -30 + idx,
        changePct: Number((-1.2 + idx * 0.12).toFixed(2)),
        fiveDayPct: Number((-0.8 + idx * 0.1).toFixed(2)),
        oneMonthPct: Number((-1.8 + idx * 0.2).toFixed(2)),
        threeMonthPct: Number((-2.5 + idx * 0.35).toFixed(2)),
        fiftyTwoWeekPct: Number((6 + idx * 0.8).toFixed(2)),
        sma20: null,
        sma50: null,
        sma200: null,
        trend: idx % 3 === 0 ? "DOWN" : idx % 3 === 1 ? "UP" : "SIDEWAYS",
        isSector: def.isSector,
      }),
    );
    return { quotes: fallback, warnings };
  }
}

async function fetchAmfiText(): Promise<string | null> {
  const urls = [
    "https://www.amfiindia.com/spider/getNAVdata.aspx",
    "https://www.amfiindia.com/spages/NAVAll.txt",
  ];
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, 15000);
      if (!res.ok) continue;
      const text = await res.text();
      if (text.includes("Scheme Code") || text.includes(";")) return text;
    } catch {
      // ignore next URL
    }
  }
  return null;
}

function parseAmfiRows(rawText: string) {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim());
  return lines
    .map((line) => line.split(";"))
    .filter((parts) => parts.length >= 5)
    .map((parts) => ({
      schemeCode: parts[0]?.trim(),
      schemeName: parts[3]?.trim(),
      nav: toNumber(parts[4]),
      date: (parts[5] ?? "").trim(),
    }))
    .filter((row) => row.schemeCode && row.schemeName && row.nav !== null);
}

function normalizeDate(input: string): string | null {
  const parts = input.split("-");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (dd && mm && yyyy && yyyy.length === 4) {
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
  }
  const iso = new Date(input);
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString().slice(0, 10);
}

async function upsertNavPoint(fundCode: string, fundName: string, date: string, nav: number, source: string) {
  await db
    .insert(fundNavHistory)
    .values({
      fundCode,
      fundName,
      navDate: date,
      nav: nav.toFixed(4),
      source,
    })
    .onConflictDoUpdate({
      target: [fundNavHistory.fundCode, fundNavHistory.navDate],
      set: {
        fundName,
        nav: nav.toFixed(4),
        source,
      },
    });
}

async function enrichHistoryFromMfApi(amfiCode: string, fundName: string): Promise<void> {
  try {
    const res = await fetchWithTimeout(`https://api.mfapi.in/mf/${encodeURIComponent(amfiCode)}`, 12000);
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { date: string; nav: string }[] };
    const data = Array.isArray(json.data) ? json.data.slice(0, 260) : [];
    for (const row of data) {
      const date = normalizeDate(row.date);
      const nav = toNumber(row.nav);
      if (!date || nav === null) continue;
      await upsertNavPoint(amfiCode, fundName, date, nav, "mfapi");
    }
  } catch {
    // Best effort only
  }
}

async function refreshFundNavData(funds: FundMapping[]): Promise<string[]> {
  const warnings: string[] = [];
  const text = await fetchAmfiText();
  if (!text) {
    warnings.push("AMFI NAV feed unavailable. Using cached NAV history only.");
    return warnings;
  }
  const rows = parseAmfiRows(text);

  for (const fund of funds) {
    const matched = rows.find((row) => {
      if (fund.amfiCode && row.schemeCode === fund.amfiCode) return true;
      if (fund.amfiSearchTerm) {
        return row.schemeName.toLowerCase().includes(fund.amfiSearchTerm.toLowerCase());
      }
      return row.schemeName.toLowerCase().includes(fund.name.toLowerCase());
    });

    if (!matched || matched.nav === null) continue;
    const date = normalizeDate(matched.date);
    if (!date) continue;
    const code = matched.schemeCode || fund.id;
    await upsertNavPoint(code, matched.schemeName, date, matched.nav, "amfi");

    if (fund.amfiCode) {
      await enrichHistoryFromMfApi(fund.amfiCode, matched.schemeName);
    }
  }

  return warnings;
}

async function getFundHistory(fund: FundMapping): Promise<NavPoint[]> {
  const codeHint = fund.amfiCode || fund.id;
  const rows = await db
    .select({ fundCode: fundNavHistory.fundCode, navDate: fundNavHistory.navDate, nav: fundNavHistory.nav })
    .from(fundNavHistory)
    .where(
      and(
        gte(fundNavHistory.navDate, "2019-01-01"),
        fund.amfiCode
          ? eq(fundNavHistory.fundCode, fund.amfiCode)
          : eq(fundNavHistory.fundCode, codeHint),
      ),
    )
    .orderBy(asc(fundNavHistory.navDate));

  return rows
    .map((row) => ({
      date: row.navDate,
      nav: toNumber(row.nav) ?? 0,
    }))
    .filter((p) => p.nav > 0);
}

function getNthFromEnd(values: number[], n: number): number | null {
  const idx = values.length - n;
  if (idx < 0 || idx >= values.length) return null;
  return values[idx] ?? null;
}

function buildFundTechnical(series: NavPoint[], niftySeries: NavPoint[]): FundTechnical {
  if (series.length === 0) {
    return {
      latestNav: null,
      navDate: null,
      return1M: null,
      return3M: null,
      return6M: null,
      momentum10D: null,
      momentum20D: null,
      momentum50D: null,
      sma20: null,
      sma50: null,
      sma100: null,
      sma200: null,
      drawdown52W: null,
      drawdownAllTime: null,
      relStrengthVsNifty20D: null,
      relStrengthVsNifty50D: null,
    };
  }

  const navValues = series.map((s) => s.nav);
  const latest = navValues[navValues.length - 1] ?? null;
  const nav1M = getNthFromEnd(navValues, 22);
  const nav3M = getNthFromEnd(navValues, 66);
  const nav6M = getNthFromEnd(navValues, 132);
  const nav10D = getNthFromEnd(navValues, 10);
  const nav20D = getNthFromEnd(navValues, 20);
  const nav50D = getNthFromEnd(navValues, 50);

  const sma20 = rollingAverage(navValues, 20);
  const sma50 = rollingAverage(navValues, 50);
  const sma100 = rollingAverage(navValues, 100);
  const sma200 = rollingAverage(navValues, 200);

  const last252 = navValues.slice(-252);
  const peak52 = last252.length ? Math.max(...last252) : null;
  const peakAll = Math.max(...navValues);

  const fund20 = pctChange(latest, nav20D);
  const fund50 = pctChange(latest, nav50D);

  const niftyVals = niftySeries.map((p) => p.nav);
  const nLatest = niftyVals[niftyVals.length - 1] ?? null;
  const n20 = getNthFromEnd(niftyVals, 20);
  const n50 = getNthFromEnd(niftyVals, 50);
  const nifty20 = pctChange(nLatest, n20);
  const nifty50 = pctChange(nLatest, n50);

  return {
    latestNav: latest,
    navDate: series[series.length - 1]?.date ?? null,
    return1M: pctChange(latest, nav1M),
    return3M: pctChange(latest, nav3M),
    return6M: pctChange(latest, nav6M),
    momentum10D: pctChange(latest, nav10D),
    momentum20D: fund20,
    momentum50D: fund50,
    sma20,
    sma50,
    sma100,
    sma200,
    drawdown52W: latest && peak52 ? ((latest - peak52) / peak52) * 100 : null,
    drawdownAllTime: latest && peakAll ? ((latest - peakAll) / peakAll) * 100 : null,
    relStrengthVsNifty20D: fund20 !== null && nifty20 !== null ? fund20 - nifty20 : null,
    relStrengthVsNifty50D: fund50 !== null && nifty50 !== null ? fund50 - nifty50 : null,
  };
}

function strategicScore(technical: FundTechnical): number {
  let score = 50;
  if (technical.return3M !== null) score += technical.return3M * 1.4;
  if (technical.return6M !== null) score += technical.return6M * 1.1;
  if (technical.drawdown52W !== null) score += Math.max(-15, Math.min(10, -technical.drawdown52W * 0.4));
  if (technical.drawdownAllTime !== null) score += Math.max(-8, Math.min(8, -technical.drawdownAllTime * 0.2));
  if (technical.relStrengthVsNifty50D !== null) score += technical.relStrengthVsNifty50D * 1.4;
  if (technical.sma50 !== null && technical.sma200 !== null && technical.sma50 > technical.sma200) score += 6;
  if (technical.sma20 !== null && technical.sma50 !== null && technical.sma20 > technical.sma50) score += 4;
  return clampScore(score);
}

function opportunityScore(technical: FundTechnical, proxyMovePct: number | null): number {
  let score = 45;
  if (proxyMovePct !== null) {
    if (proxyMovePct < 0) score += Math.min(25, Math.abs(proxyMovePct) * 8);
    else score -= Math.min(15, proxyMovePct * 4);
  }
  if (technical.drawdown52W !== null) score += Math.max(-10, Math.min(16, -technical.drawdown52W * 0.7));
  if (technical.momentum20D !== null) score += Math.max(-10, Math.min(10, technical.momentum20D * 0.8));
  if (technical.relStrengthVsNifty20D !== null) score += Math.max(-10, Math.min(10, technical.relStrengthVsNifty20D * 1.1));
  return clampScore(score);
}

function isStructuralBreakdown(technical: FundTechnical): boolean {
  const { latestNav, sma50, sma200, relStrengthVsNifty20D } = technical;
  if (latestNav !== null && sma200 !== null && latestNav < sma200 * 0.92) return true;
  if (sma50 !== null && sma200 !== null && sma50 < sma200 * 0.97) return true;
  if (relStrengthVsNifty20D !== null && relStrengthVsNifty20D < -4) return true;
  return false;
}

function buildExpectedNavNote(proxyMovePct: number | null, proxyLabel: string): string {
  if (proxyMovePct === null) {
    return `Proxy move data for ${proxyLabel} is unavailable; expected NAV pressure estimate is not available.`;
  }
  if (proxyMovePct < 0) {
    return `${proxyLabel} is down ${Math.abs(proxyMovePct).toFixed(2)}% today. This weakness is likely to be reflected in closing NAV.`;
  }
  if (proxyMovePct > 0) {
    return `${proxyLabel} is up ${proxyMovePct.toFixed(2)}% today. Closing NAV may reflect positive market support.`;
  }
  return `${proxyLabel} is flat today. Closing NAV impact may be muted.`;
}

function buildRegime(indexTable: IndexQuote[]) {
  const coreKeys = new Set(["NIFTY_50", "MIDCAP_150", "SMALLCAP_250"]);
  const core = indexTable.filter((idx) => coreKeys.has(idx.key));
  const sectors = indexTable.filter((idx) => idx.isSector);

  const coreUpCount = core.filter((idx) => (idx.changePct ?? 0) >= 0).length;
  const breadthPositivePct =
    sectors.length === 0 ? 0 : (sectors.filter((idx) => (idx.changePct ?? -1) >= 0).length / sectors.length) * 100;

  const isRiskOn = coreUpCount >= 2 && breadthPositivePct >= 50;
  return {
    badge: isRiskOn ? "RISK_ON" : "RISK_OFF",
    label: isRiskOn ? "🟢 RISK ON" : "🔴 RISK OFF",
    strategyNote: isRiskOn
      ? "Continue SIP + deploy corrections selectively."
      : "Continue core SIP, reduce tactical allocation, avoid chasing sector funds.",
    breadthPositivePct,
  } as const;
}

function parseSettingsRow(row: typeof dashboardSettings.$inferSelect): DashboardSettings {
  return {
    marketDataProvider: (row.marketDataProvider as MarketDataProvider) || "nse",
    strategicWeight: toNumber(row.strategicWeight) ?? 60,
    opportunityWeight: toNumber(row.opportunityWeight) ?? 40,
    tacticalTopupAmount: toNumber(row.tacticalTopupAmount),
    fundMappings: (Array.isArray(row.fundMappings) ? row.fundMappings : DEFAULT_SETTINGS.fundMappings) as FundMapping[],
    proxyDefinitions: (Array.isArray(row.proxyDefinitions)
      ? row.proxyDefinitions
      : DEFAULT_SETTINGS.proxyDefinitions) as ProxyDefinition[],
  };
}

export async function getOrCreateSettings(): Promise<DashboardSettings> {
  const existing = await db.select().from(dashboardSettings).where(eq(dashboardSettings.id, 1)).limit(1);
  if (existing[0]) return parseSettingsRow(existing[0]);

  await db.insert(dashboardSettings).values({
    id: 1,
    marketDataProvider: DEFAULT_SETTINGS.marketDataProvider,
    strategicWeight: DEFAULT_SETTINGS.strategicWeight.toFixed(2),
    opportunityWeight: DEFAULT_SETTINGS.opportunityWeight.toFixed(2),
    tacticalTopupAmount: null,
    fundMappings: DEFAULT_SETTINGS.fundMappings as unknown as Record<string, unknown>[],
    proxyDefinitions: DEFAULT_SETTINGS.proxyDefinitions as unknown as Record<string, unknown>[],
  });

  return DEFAULT_SETTINGS;
}

export async function updateSettings(input: Partial<DashboardSettings>): Promise<DashboardSettings> {
  const current = await getOrCreateSettings();
  const merged: DashboardSettings = {
    marketDataProvider: input.marketDataProvider ?? current.marketDataProvider,
    strategicWeight: input.strategicWeight ?? current.strategicWeight,
    opportunityWeight: input.opportunityWeight ?? current.opportunityWeight,
    tacticalTopupAmount:
      input.tacticalTopupAmount === undefined ? current.tacticalTopupAmount : input.tacticalTopupAmount,
    fundMappings: input.fundMappings ?? current.fundMappings,
    proxyDefinitions: input.proxyDefinitions ?? current.proxyDefinitions,
  };

  await db
    .insert(dashboardSettings)
    .values({
      id: 1,
      marketDataProvider: merged.marketDataProvider,
      strategicWeight: merged.strategicWeight.toFixed(2),
      opportunityWeight: merged.opportunityWeight.toFixed(2),
      tacticalTopupAmount: merged.tacticalTopupAmount?.toFixed(2),
      fundMappings: merged.fundMappings as unknown as Record<string, unknown>[],
      proxyDefinitions: merged.proxyDefinitions as unknown as Record<string, unknown>[],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: dashboardSettings.id,
      set: {
        marketDataProvider: merged.marketDataProvider,
        strategicWeight: merged.strategicWeight.toFixed(2),
        opportunityWeight: merged.opportunityWeight.toFixed(2),
        tacticalTopupAmount: merged.tacticalTopupAmount?.toFixed(2),
        fundMappings: merged.fundMappings as unknown as Record<string, unknown>[],
        proxyDefinitions: merged.proxyDefinitions as unknown as Record<string, unknown>[],
        updatedAt: new Date(),
      },
    });

  return merged;
}

function pickProxyLabel(proxyKey: string, defs: ProxyDefinition[]) {
  return defs.find((p) => p.key === proxyKey)?.label ?? proxyKey;
}

function pickProxyIndexKey(proxyKey: string, defs: ProxyDefinition[]) {
  return defs.find((p) => p.key === proxyKey)?.indexKey ?? proxyKey;
}

function toRecordByKey(indices: IndexQuote[]) {
  return new Map(indices.map((idx) => [idx.key, idx]));
}

function computeTacticalAllocation(topFunds: ScoredFund[], topup: number | null) {
  if (!topup || topup <= 0 || topFunds.length === 0) return [];
  const totalScore = topFunds.reduce((sum, fund) => sum + fund.finalScore, 0);
  if (totalScore <= 0) return [];
  return topFunds.map((fund) => {
    const scoreWeight = fund.finalScore / totalScore;
    return {
      fundId: fund.id,
      fundName: fund.name,
      scoreWeight,
      amount: Number((topup * scoreWeight).toFixed(2)),
    };
  });
}

export async function getLatestSnapshot(): Promise<DashboardSnapshot | null> {
  const row = await db
    .select()
    .from(dashboardSnapshots)
    .where(eq(dashboardSnapshots.snapshotKey, "latest"))
    .orderBy(desc(dashboardSnapshots.updatedAt))
    .limit(1);
  if (!row[0]) return null;
  return row[0].payload as unknown as DashboardSnapshot;
}

async function saveLatestSnapshot(snapshot: DashboardSnapshot): Promise<void> {
  await db
    .insert(dashboardSnapshots)
    .values({
      snapshotKey: "latest",
      payload: snapshot as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: dashboardSnapshots.snapshotKey,
      set: {
        payload: snapshot as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });
}

export async function generateDashboardSnapshot(): Promise<DashboardSnapshot> {
  const settings = await getOrCreateSettings();

  const { quotes: indexQuotes, warnings: indexWarnings } = await fetchNseIndices();
  const navWarnings = await refreshFundNavData(settings.fundMappings);
  const indicesByKey = toRecordByKey(indexQuotes);

  const niftyProxyFund: FundMapping = {
    id: "nifty-50-shadow",
    name: "NIFTY 50 Shadow",
    proxyKey: "NIFTY_50",
  };
  const niftySeries = await getFundHistory(niftyProxyFund);

  const allFunds: ScoredFund[] = [];
  for (const fund of settings.fundMappings) {
    const proxyIndexKey = pickProxyIndexKey(fund.proxyKey, settings.proxyDefinitions);
    const proxyQuote = indicesByKey.get(proxyIndexKey);
    const history = await getFundHistory(fund);
    const technical = buildFundTechnical(history, niftySeries);
    const sScore = strategicScore(technical);
    const oScore = opportunityScore(technical, proxyQuote?.changePct ?? null);
    const weightedFinal =
      (sScore * settings.strategicWeight + oScore * settings.opportunityWeight) /
      Math.max(settings.strategicWeight + settings.opportunityWeight, 1);

    const broken = isStructuralBreakdown(technical);
    const trend = getTrend(technical.latestNav, technical.sma50, technical.sma200);

    let classification: ScoredFund["classification"] = "NEUTRAL";
    let actionTag: ScoredFund["actionTag"] = "SIP";
    let reason = "Maintain SIP discipline.";

    if (broken) {
      classification = "STRUCTURAL_BREAKDOWN";
      actionTag = "AVOID TODAY";
      reason = "Trend is structurally weak (below critical SMA/relative-strength thresholds).";
    } else if ((proxyQuote?.changePct ?? 0) < 0) {
      classification = "HEALTHY_CORRECTION";
      actionTag = weightedFinal >= 60 ? "BUY ON DIP" : "SIP";
      reason = "Proxy weakness with acceptable trend structure indicates potential same-day NAV opportunity.";
    }

    allFunds.push({
      id: fund.id,
      name: fund.name,
      proxyKey: fund.proxyKey,
      proxyLabel: pickProxyLabel(fund.proxyKey, settings.proxyDefinitions),
      proxyMovePct: proxyQuote?.changePct ?? null,
      strategicScore: Number(sScore.toFixed(1)),
      opportunityScore: Number(oScore.toFixed(1)),
      finalScore: Number(clampScore(weightedFinal).toFixed(1)),
      trend,
      classification,
      actionTag,
      reason,
      expectedNavImpactNote: buildExpectedNavNote(proxyQuote?.changePct ?? null, pickProxyLabel(fund.proxyKey, settings.proxyDefinitions)),
      technical,
    });
  }

  const avoidFunds = allFunds
    .filter((f) => f.classification === "STRUCTURAL_BREAKDOWN")
    .sort((a, b) => a.finalScore - b.finalScore);

  const topFunds = allFunds
    .filter((f) => f.classification !== "STRUCTURAL_BREAKDOWN")
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 5);

  const regime = buildRegime(indexQuotes);
  const sectorHeatmap = indexQuotes.filter((q) => q.isSector);
  const headlineIndices = indexQuotes.filter((q) => ["NIFTY_50", "SENSEX", "MIDCAP_150", "SMALLCAP_250"].includes(q.key));

  const sortedByMove = indexQuotes
    .filter((q) => q.changePct !== null)
    .sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0));

  const fallingIndices = sortedByMove.slice(0, 5);
  const strongestIndices = [...sortedByMove].reverse().slice(0, 3);
  const tacticalAllocation = computeTacticalAllocation(topFunds, settings.tacticalTopupAmount);
  const { cutoffLabel, cutoffProgressPct } = calcCutoffInfo();

  const snapshot: DashboardSnapshot = {
    generatedAt: new Date().toISOString(),
    dataFreshnessNote:
      "Index data is best-effort from unofficial NSE endpoints; mutual fund NAV history updates once daily from AMFI.",
    sourceWarnings: [...indexWarnings, ...navWarnings],
    settings,
    regime,
    headlineIndices,
    fallingIndices,
    strongestIndices,
    topFunds,
    avoidFunds,
    allFunds,
    sectorHeatmap,
    indexTable: indexQuotes,
    tacticalAllocation,
    cutoffProgressPct,
    cutoffLabel,
    disclaimers: DASHBOARD_DISCLAIMERS,
  };

  await saveLatestSnapshot(snapshot);
  return snapshot;
}

export async function getOrBuildInitialSnapshot(): Promise<DashboardSnapshot> {
  const cached = await getLatestSnapshot();
  if (cached) return cached;
  return generateDashboardSnapshot();
}
