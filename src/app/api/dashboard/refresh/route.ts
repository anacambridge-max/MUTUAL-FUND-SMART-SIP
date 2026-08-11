import { generateDashboardSnapshot } from "@/lib/dashboard-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await generateDashboardSnapshot();
    return Response.json({ ok: true, snapshot });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        snapshot: null,
        error: error instanceof Error ? error.message : "Refresh failed",
      },
      { status: 500 },
    );
  }
}
