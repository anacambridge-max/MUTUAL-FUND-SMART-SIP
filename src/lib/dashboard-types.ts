export type MarketDataProvider = "nse" | "zerodha" | "manual";
export type TrendState = "UP" | "DOWN" | "SIDEWAYS";
export type FundActionTag = "BUY ON DIP" | "SIP" | "WAIT" | "AVOID TODAY";
export type FundClassification = "HEALTHY_CORRECTION" | "STRUCTURAL_BREAKDOWN" | "NEUTRAL";

export type IndexQuote = {
  key: string; name: string; value: number | null; change: number | null; changePct: number | null;
  fiveDayPct: number | null; oneMonthPct: number | null; threeMonthPct: number | null; fiftyTwoWeekPct: number | null;
  sma20: number | null; sma50: number | null; sma200: number | null; trend: TrendState; isSector: boolean;
};
export type ProxyDefinition = { key: string; label: string; indexKey: string };
export type FundMapping = { id: string; name: string; proxyKey: string; amfiCode?: string; amfiSearchTerm?: string };

export type FundTechnical = {
  latestNav: number | null; navDate: string | null; estimatedNav: number | null; estimatedNavChangePct: number | null;
  navOpportunityScore: number; navOpportunityLabel: string;
  return1M: number | null; return3M: number | null; return6M: number | null; momentum10D: number | null;
  momentum20D: number | null; momentum50D: number | null; sma20: number | null; sma50: number | null; sma100: number | null;
  sma200: number | null; drawdown52W: number | null; drawdownAllTime: number | null;
  relStrengthVsNifty20D: number | null; relStrengthVsNifty50D: number | null;
};
export type ScoredFund = {
  id: string; name: string; proxyKey: string; proxyLabel: string; proxyMovePct: number | null;
  strategicScore: number; opportunityScore: number; finalScore: number; trend: TrendState;
  classification: FundClassification; actionTag: FundActionTag; reason: string; expectedNavImpactNote: string;
  executionSignal: string; confidence: string; technical: FundTechnical;
};
export type Regime = { badge: "RISK_ON" | "RISK_OFF"; label: string; strategyNote: string; breadthPositivePct: number };
export type DashboardSettings = {
  marketDataProvider: MarketDataProvider; strategicWeight: number; opportunityWeight: number; tacticalTopupAmount: number | null;
  fundMappings: FundMapping[]; proxyDefinitions: ProxyDefinition[];
};
export type TacticalAllocationItem = { fundId: string; fundName: string; amount: number; scoreWeight: number };
export type DashboardSnapshot = {
  generatedAt: string; dataFreshnessNote: string; sourceWarnings: string[]; settings: DashboardSettings; regime: Regime;
  headlineIndices: IndexQuote[]; fallingIndices: IndexQuote[]; strongestIndices: IndexQuote[]; topFunds: ScoredFund[];
  avoidFunds: ScoredFund[]; allFunds: ScoredFund[]; lowerNavOpportunities: ScoredFund[]; sectorHeatmap: IndexQuote[];
  indexTable: IndexQuote[]; tacticalAllocation: TacticalAllocationItem[]; cutoffProgressPct: number; cutoffLabel: string; disclaimers: string[];
};
export type DashboardApiResponse = { ok: boolean; snapshot: DashboardSnapshot | null; error?: string };