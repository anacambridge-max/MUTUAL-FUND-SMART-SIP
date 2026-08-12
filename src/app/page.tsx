import PremiumTerminal from "@/components/premium-terminal";
import { buildFallbackSnapshot, generateDashboardSnapshot } from "@/lib/dashboard-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let initialSnapshot;
  try {
    initialSnapshot = await generateDashboardSnapshot();
  } catch {
    initialSnapshot = buildFallbackSnapshot();
  }

  return <PremiumTerminal initialSnapshot={initialSnapshot} />;
}
