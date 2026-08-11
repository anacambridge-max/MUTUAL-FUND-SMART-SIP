export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    database: false,
    message: "Smart MF dashboard is running without a database.",
  });
}
