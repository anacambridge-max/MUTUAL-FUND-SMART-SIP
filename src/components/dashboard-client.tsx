"use client";

import { useMemo, useState } from "react";
import type { DashboardSnapshot, FundMapping, IndexQuote, ProxyDefinition } from "@/lib/dashboard-types";

type Props = {
  initialSnapshot: DashboardSnapshot;
};

function fmtPct(v: number | null) {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtNum(v: number | null) {
  if (v === null) return "—";
  return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function toneByMove(move: number | null) {
  if (move === null) return "text-slate-500";
  if (move > 0) return "text-emerald-600";
  if (move < 0) return "text-rose-600";
  return "text-slate-700";
}

export default function DashboardClient({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(initialSnapshot);
  const [loading, setLoading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const [marketDataProvider, setMarketDataProvider] = useState(snapshot.settings.marketDataProvider);
  const [strategicWeight, setStrategicWeight] = useState(String(snapshot.settings.strategicWeight));
  const [opportunityWeight, setOpportunityWeight] = useState(String(snapshot.settings.opportunityWeight));
  const [tacticalTopup, setTacticalTopup] = useState(snapshot.settings.tacticalTopupAmount?.toString() ?? "");
  const [fundMappings, setFundMappings] = useState<FundMapping[]>(snapshot.settings.fundMappings);
  const [proxyDefinitions, setProxyDefinitions] = useState<ProxyDefinition[]>(snapshot.settings.proxyDefinitions);

  const lastUpdated = useMemo(() => {
    const d = new Date(snapshot.generatedAt);
    return d.toLocaleTimeString("en-IN", { hour12: false });
  }, [snapshot.generatedAt]);

  async function refreshDashboard() {
    setLoading(true);
    setBannerError(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch("/api/dashboard/refresh", { signal: controller.signal });
      const data = (await res.json()) as { ok: boolean; snapshot: DashboardSnapshot | null; error?: string };
      if (!res.ok || !data.ok || !data.snapshot) {
        throw new Error(data.error || "Refresh failed.");
      }
      setSnapshot(data.snapshot);
      setMarketDataProvider(data.snapshot.settings.marketDataProvider);
      setStrategicWeight(String(data.snapshot.settings.strategicWeight));
      setOpportunityWeight(String(data.snapshot.settings.opportunityWeight));
      setTacticalTopup(data.snapshot.settings.tacticalTopupAmount?.toString() ?? "");
      setFundMappings(data.snapshot.settings.fundMappings);
      setProxyDefinitions(data.snapshot.settings.proxyDefinitions);
    } catch (error) {
      setBannerError(error instanceof Error ? error.message : "Unable to refresh now. Last good data is still shown.");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  function updateFundRow(index: number, patch: Partial<FundMapping>) {
    setFundMappings((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeFund(index: number) {
    setFundMappings((prev) => prev.filter((_, i) => i !== index));
  }

  function addFund() {
    const id = `fund-${Date.now()}`;
    setFundMappings((prev) => [...prev, { id, name: "", proxyKey: proxyDefinitions[0]?.key ?? "NIFTY_50" }]);
  }

  async function saveSettings() {
    setSavingSettings(true);
    setSettingsMessage(null);
    setBannerError(null);

    const payload = {
      marketDataProvider,
      strategicWeight: Number(strategicWeight),
      opportunityWeight: Number(opportunityWeight),
      tacticalTopupAmount: tacticalTopup.trim() ? Number(tacticalTopup) : null,
      fundMappings,
      proxyDefinitions,
    };

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Unable to save settings.");
      setSettingsMessage("Settings saved. Click Refresh to recompute using new configuration.");
    } catch (error) {
      setBannerError(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  const heatmapColumns = 4;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 md:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Smart MF Daily Decision Terminal</h1>
            <p className="mt-1 text-sm text-slate-600">Last updated: {lastUpdated} • {snapshot.dataFreshnessNote}</p>
          </div>
          <button
            type="button"
            onClick={refreshDashboard}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "🔄 Refresh"}
          </button>
        </div>
        {bannerError ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{bannerError}</p>
        ) : null}
        {snapshot.sourceWarnings.length > 0 ? (
          <div className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {snapshot.sourceWarnings.map((w) => (
              <p key={w}>• {w}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{snapshot.regime.label}</h2>
        <p className="text-sm text-slate-700">{snapshot.regime.strategyNote}</p>
        <p className="mt-1 text-xs text-slate-500">Breadth: {snapshot.regime.breadthPositivePct.toFixed(1)}% sectors green</p>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {snapshot.headlineIndices.map((idx) => (
          <div key={idx.key} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{idx.name}</p>
            <p className="mt-1 text-lg font-semibold">{fmtNum(idx.value)}</p>
            <p className={`text-sm font-medium ${toneByMove(idx.changePct)}`}>{fmtPct(idx.changePct)}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold">Biggest Falling Indices</h3>
          <ul className="mt-2 space-y-2">
            {snapshot.fallingIndices.map((idx) => (
              <li key={idx.key} className="flex items-center justify-between text-sm">
                <span>{idx.name}</span>
                <span className={toneByMove(idx.changePct)}>{fmtPct(idx.changePct)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold">Strongest Indices</h3>
          <ul className="mt-2 space-y-2">
            {snapshot.strongestIndices.map((idx) => (
              <li key={idx.key} className="flex items-center justify-between text-sm">
                <span>{idx.name}</span>
                <span className={toneByMove(idx.changePct)}>{fmtPct(idx.changePct)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold">🔥 Top 5 Funds Today</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.topFunds.map((fund) => (
            <article key={fund.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{fund.name}</p>
              <p className="mt-1 text-xs text-slate-500">Proxy: {fund.proxyLabel} ({fmtPct(fund.proxyMovePct)})</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-1">Strategic: {fund.strategicScore}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">Opportunity: {fund.opportunityScore}</span>
                <span className="rounded-full bg-slate-900 px-2 py-1 text-white">Final: {fund.finalScore}</span>
              </div>
              <p className="mt-2 text-xs text-slate-700">Trend: {fund.trend}</p>
              <p className="mt-1 text-xs font-semibold text-indigo-700">{fund.actionTag}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold">⚠️ Avoid Today</h3>
        {snapshot.avoidFunds.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No funds triggered structural breakdown filters.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {snapshot.avoidFunds.map((fund) => (
              <li key={fund.id} className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
                <p className="font-semibold text-rose-900">{fund.name}</p>
                <p className="text-rose-800">{fund.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold">Sector Heatmap</h3>
        <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${heatmapColumns}, minmax(0, 1fr))` }}>
          {snapshot.sectorHeatmap.map((idx) => {
            const bg =
              (idx.changePct ?? 0) > 0
                ? "bg-emerald-100 border-emerald-200"
                : (idx.changePct ?? 0) < 0
                  ? "bg-rose-100 border-rose-200"
                  : "bg-slate-100 border-slate-200";
            return (
              <div key={idx.key} className={`rounded-lg border p-2 ${bg}`}>
                <p className="text-xs font-medium text-slate-800">{idx.name}</p>
                <p className={`text-sm font-semibold ${toneByMove(idx.changePct)}`}>{fmtPct(idx.changePct)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold">Index Dashboard</h3>
        <table className="mt-3 min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4">Index</th>
              <th className="py-2 pr-4">Today</th>
              <th className="py-2 pr-4">5D</th>
              <th className="py-2 pr-4">1M</th>
              <th className="py-2 pr-4">3M</th>
              <th className="py-2 pr-4">52W</th>
              <th className="py-2 pr-4">20DMA</th>
              <th className="py-2 pr-4">50DMA</th>
              <th className="py-2 pr-4">200DMA</th>
              <th className="py-2 pr-4">Trend</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.indexTable.map((idx) => (
              <tr key={idx.key} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-900">{idx.name}</td>
                <td className={`py-2 pr-4 ${toneByMove(idx.changePct)}`}>{fmtPct(idx.changePct)}</td>
                <td className="py-2 pr-4">{fmtPct(idx.fiveDayPct)}</td>
                <td className="py-2 pr-4">{fmtPct(idx.oneMonthPct)}</td>
                <td className="py-2 pr-4">{fmtPct(idx.threeMonthPct)}</td>
                <td className="py-2 pr-4">{fmtPct(idx.fiftyTwoWeekPct)}</td>
                <td className="py-2 pr-4">{fmtNum(idx.sma20)}</td>
                <td className="py-2 pr-4">{fmtNum(idx.sma50)}</td>
                <td className="py-2 pr-4">{fmtNum(idx.sma200)}</td>
                <td className="py-2 pr-4">{idx.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold">Fund vs Market Map</h3>
        <div className="mt-2 space-y-2">
          {snapshot.allFunds.map((fund) => (
            <article key={fund.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{fund.name}</p>
              <p className="text-xs text-slate-600">
                {fund.proxyLabel} → {fmtPct(fund.proxyMovePct)}
              </p>
              <p className="mt-1 text-xs text-slate-700">{fund.expectedNavImpactNote}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold">Same-Day NAV Cut-off Window</h3>
        <p className="mt-1 text-sm text-slate-700">{snapshot.cutoffLabel}</p>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.min(snapshot.cutoffProgressPct, 100)}%` }} />
        </div>
      </section>

      {snapshot.tacticalAllocation.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold">Suggested Tactical Allocation</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {snapshot.tacticalAllocation.map((row) => (
              <li key={row.fundId} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                <span>{row.fundName}</span>
                <span className="font-semibold">₹{row.amount.toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="text-sm font-semibold text-slate-900 underline"
        >
          {settingsOpen ? "Hide" : "Show"} Settings / Config
        </button>

        {settingsOpen ? (
          <div className="mt-3 space-y-3 text-sm">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="flex flex-col gap-1">
                Market provider
                <select
                  className="rounded-lg border border-slate-300 px-2 py-1"
                  value={marketDataProvider}
                  onChange={(e) => setMarketDataProvider(e.target.value as typeof marketDataProvider)}
                >
                  <option value="nse">nse</option>
                  <option value="zerodha">zerodha</option>
                  <option value="manual">manual</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Strategic weight
                <input
                  className="rounded-lg border border-slate-300 px-2 py-1"
                  value={strategicWeight}
                  onChange={(e) => setStrategicWeight(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                Opportunity weight
                <input
                  className="rounded-lg border border-slate-300 px-2 py-1"
                  value={opportunityWeight}
                  onChange={(e) => setOpportunityWeight(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                Tactical top-up (₹)
                <input
                  className="rounded-lg border border-slate-300 px-2 py-1"
                  value={tacticalTopup}
                  onChange={(e) => setTacticalTopup(e.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Fund → Proxy Mapping</h4>
                <button type="button" onClick={addFund} className="rounded bg-slate-900 px-2 py-1 text-xs text-white">
                  + Add Fund
                </button>
              </div>
              {fundMappings.map((fund, idx) => (
                <div key={fund.id} className="grid gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-5">
                  <input
                    className="rounded border border-slate-300 px-2 py-1"
                    value={fund.id}
                    onChange={(e) => updateFundRow(idx, { id: e.target.value })}
                    placeholder="id"
                  />
                  <input
                    className="rounded border border-slate-300 px-2 py-1 md:col-span-2"
                    value={fund.name}
                    onChange={(e) => updateFundRow(idx, { name: e.target.value })}
                    placeholder="Fund name"
                  />
                  <select
                    className="rounded border border-slate-300 px-2 py-1"
                    value={fund.proxyKey}
                    onChange={(e) => updateFundRow(idx, { proxyKey: e.target.value })}
                  >
                    {proxyDefinitions.map((proxy) => (
                      <option key={proxy.key} value={proxy.key}>
                        {proxy.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeFund(idx)}
                    className="rounded border border-rose-300 px-2 py-1 text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={savingSettings}
              onClick={saveSettings}
              className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white disabled:opacity-60"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
            {settingsMessage ? <p className="text-xs text-emerald-700">{settingsMessage}</p> : null}
          </div>
        ) : null}
      </section>

      <footer className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        <p className="font-semibold">Data Attribution</p>
        <p>NSE India (unofficial JSON endpoints, best-effort) and AMFI official daily NAV data.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {snapshot.disclaimers.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="mt-2">Proxy mapping is a category approximation, not the fund&apos;s actual portfolio holdings.</p>
      </footer>
    </main>
  );
}
