import type { DashboardSettings, FundMapping, ProxyDefinition } from "@/lib/dashboard-types";

export const DEFAULT_PROXY_DEFINITIONS: ProxyDefinition[] = [
  { key: "NIFTY_50", label: "NIFTY 50", indexKey: "NIFTY_50" },
  { key: "NIFTY_NEXT_50", label: "NIFTY Next 50", indexKey: "NIFTY_NEXT_50" },
  { key: "SENSEX", label: "Sensex", indexKey: "SENSEX" },
  { key: "MIDCAP_150", label: "NIFTY Midcap 150", indexKey: "MIDCAP_150" },
  { key: "SMALLCAP_250", label: "NIFTY Smallcap 250", indexKey: "SMALLCAP_250" },
  { key: "LARGEMIDCAP_250", label: "NIFTY LargeMidcap 250", indexKey: "LARGEMIDCAP_250" },
  { key: "NIFTY_IT", label: "NIFTY IT", indexKey: "NIFTY_IT" },
  { key: "NIFTY_PHARMA", label: "NIFTY Pharma", indexKey: "NIFTY_PHARMA" },
  { key: "NIFTY_FIN_SERVICE", label: "NIFTY Financial Services", indexKey: "NIFTY_FIN_SERVICE" },
  { key: "BANK_NIFTY", label: "NIFTY Bank", indexKey: "BANK_NIFTY" },
  { key: "NIFTY_AUTO", label: "NIFTY Auto", indexKey: "NIFTY_AUTO" },
  { key: "NIFTY_FMCG", label: "NIFTY FMCG", indexKey: "NIFTY_FMCG" },
  { key: "NIFTY_METAL", label: "NIFTY Metal", indexKey: "NIFTY_METAL" },
  { key: "NIFTY_REALTY", label: "NIFTY Realty", indexKey: "NIFTY_REALTY" },
  { key: "NIFTY_ENERGY", label: "NIFTY Energy", indexKey: "NIFTY_ENERGY" },
  { key: "NIFTY_PSU_BANK", label: "NIFTY PSU Bank", indexKey: "NIFTY_PSU_BANK" },
  { key: "NIFTY_INFRA", label: "NIFTY Infrastructure", indexKey: "NIFTY_INFRA" },
  { key: "NIFTY_SERVICES", label: "NIFTY Services Sector", indexKey: "NIFTY_SERVICES" },
  { key: "GOLD_PROXY", label: "Gold Proxy", indexKey: "GOLD_PROXY" },
];

export const DEFAULT_FUND_MAPPINGS: FundMapping[] = [
  { id: "sbi-nifty-50", name: "SBI Nifty 50 Index Fund", proxyKey: "NIFTY_50", amfiSearchTerm: "SBI Nifty 50" },
  { id: "uti-next-50", name: "UTI Nifty Next 50 Index Fund", proxyKey: "NIFTY_NEXT_50", amfiSearchTerm: "UTI Nifty Next 50" },
  { id: "uti-gold", name: "UTI Gold ETF FoF", proxyKey: "GOLD_PROXY", amfiSearchTerm: "UTI Gold" },
  { id: "sbi-small-cap", name: "SBI Small Cap Fund", proxyKey: "SMALLCAP_250", amfiSearchTerm: "SBI Small Cap" },
  { id: "hdfc-mid-cap", name: "HDFC Mid-Cap Opportunities Fund", proxyKey: "MIDCAP_150", amfiSearchTerm: "HDFC Mid" },
  { id: "quant-large-mid", name: "Quant Large and Mid Cap Fund", proxyKey: "LARGEMIDCAP_250", amfiCode: "120826", amfiSearchTerm: "Quant Large and Mid" },
  { id: "tata-digital", name: "Tata Digital India Fund", proxyKey: "NIFTY_IT", amfiSearchTerm: "Tata Digital India" },
  { id: "sbi-healthcare", name: "SBI Healthcare Opportunities Fund", proxyKey: "NIFTY_PHARMA", amfiSearchTerm: "SBI Healthcare" },
  { id: "quant-bfsi", name: "Quant BFSI Fund", proxyKey: "NIFTY_FIN_SERVICE", amfiSearchTerm: "Quant BFSI" },
  { id: "quant-infra", name: "Quant Infrastructure Fund", proxyKey: "NIFTY_INFRA", amfiSearchTerm: "Quant Infrastructure" },
  { id: "sundaram-services", name: "Sundaram Services Fund", proxyKey: "NIFTY_SERVICES", amfiSearchTerm: "Sundaram Services" },
  { id: "axis-small-cap", name: "Axis Small Cap Fund", proxyKey: "SMALLCAP_250", amfiSearchTerm: "Axis Small Cap" },
  { id: "nippon-small-cap", name: "Nippon India Small Cap Fund", proxyKey: "SMALLCAP_250", amfiSearchTerm: "Nippon India Small Cap" },
  { id: "icici-bluechip", name: "ICICI Prudential Bluechip Fund", proxyKey: "NIFTY_50", amfiSearchTerm: "ICICI Prudential Bluechip" },
  { id: "parag-flexi", name: "Parag Parikh Flexi Cap Fund", proxyKey: "NIFTY_50", amfiSearchTerm: "Parag Parikh Flexi" },
  { id: "mirae-large-cap", name: "Mirae Asset Large Cap Fund", proxyKey: "NIFTY_50", amfiSearchTerm: "Mirae Asset Large Cap" },
  { id: "kotak-emerging", name: "Kotak Emerging Equity Fund", proxyKey: "MIDCAP_150", amfiCode: "119775", amfiSearchTerm: "Kotak Emerging Equity" },
  { id: "dsp-midcap", name: "DSP Midcap Fund", proxyKey: "MIDCAP_150", amfiSearchTerm: "DSP Midcap" },
  { id: "hdfc-flexi", name: "HDFC Flexi Cap Fund", proxyKey: "NIFTY_50", amfiSearchTerm: "HDFC Flexi" },
];

export const DASHBOARD_DISCLAIMERS: string[] = [
  "This dashboard provides probability-based decision signals, not investment advice or a guaranteed NAV prediction.",
  "Today's market weakness can be reflected in a fund's closing NAV, but the actual applicable NAV depends on the scheme, cut-off and funds-realisation rules.",
  "A same-day purchase before 3:00 PM is not by itself a guarantee of same-day NAV; applicable rules and funds realisation must be satisfied.",
  "Sector/proxy mapping is an approximation and is not a substitute for the fund's actual portfolio holdings.",
  "If market or NAV data fails validation, the dashboard will suppress tactical BUY signals rather than use stale or fabricated values.",
];

export const DEFAULT_SETTINGS: DashboardSettings = {
  marketDataProvider: "nse",
  strategicWeight: 60,
  opportunityWeight: 40,
  tacticalTopupAmount: null,
  fundMappings: DEFAULT_FUND_MAPPINGS,
  proxyDefinitions: DEFAULT_PROXY_DEFINITIONS,
};
