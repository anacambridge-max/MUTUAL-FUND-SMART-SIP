import { getOrBuildInitialSnapshot } from "@/lib/dashboard-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getOrBuildInitialSnapshot();
    return Response.json({ ok: true, snapshot });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        snapshot: null,
        error: error instanceof Error ? error.message : "Failed to load dashboard",
      },
      { status: 500 },
    );
  }
}
