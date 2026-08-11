import { getOrCreateSettings, updateSettings } from "@/lib/dashboard-service";
import type { DashboardSettings, FundMapping, ProxyDefinition } from "@/lib/dashboard-types";

export const dynamic = "force-dynamic";

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function safeFundMappings(value: unknown): FundMapping[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : "";
      const name = typeof row.name === "string" ? row.name : "";
      const proxyKey = typeof row.proxyKey === "string" ? row.proxyKey : "";
      const amfiCode = typeof row.amfiCode === "string" ? row.amfiCode : undefined;
      const amfiSearchTerm = typeof row.amfiSearchTerm === "string" ? row.amfiSearchTerm : undefined;
      if (!id || !name || !proxyKey) return null;
      return { id, name, proxyKey, amfiCode, amfiSearchTerm };
    })
    .filter(Boolean) as FundMapping[];
}

function safeProxyDefinitions(value: unknown): ProxyDefinition[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const key = typeof row.key === "string" ? row.key : "";
      const label = typeof row.label === "string" ? row.label : "";
      const indexKey = typeof row.indexKey === "string" ? row.indexKey : "";
      if (!key || !label || !indexKey) return null;
      return { key, label, indexKey };
    })
    .filter(Boolean) as ProxyDefinition[];
}

export async function GET() {
  try {
    const settings = await getOrCreateSettings();
    return Response.json({ ok: true, settings });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch settings",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<DashboardSettings>;
    const strategicWeight = toNumber(body.strategicWeight);
    const opportunityWeight = toNumber(body.opportunityWeight);
    const tacticalTopupAmount =
      body.tacticalTopupAmount === null || body.tacticalTopupAmount === undefined
        ? body.tacticalTopupAmount
        : toNumber(body.tacticalTopupAmount);

    const updated = await updateSettings({
      marketDataProvider: body.marketDataProvider,
      strategicWeight: strategicWeight ?? undefined,
      opportunityWeight: opportunityWeight ?? undefined,
      tacticalTopupAmount: tacticalTopupAmount ?? null,
      fundMappings: safeFundMappings(body.fundMappings),
      proxyDefinitions: safeProxyDefinitions(body.proxyDefinitions),
    });

    return Response.json({ ok: true, settings: updated });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to update settings",
      },
      { status: 500 },
    );
  }
}
