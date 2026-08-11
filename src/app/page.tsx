import DashboardClient from "@/components/dashboard-client";
import { getOrBuildInitialSnapshot } from "@/lib/dashboard-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialSnapshot = await getOrBuildInitialSnapshot();

  return <DashboardClient initialSnapshot={initialSnapshot} />;
}
