export const runtime = "nodejs";

export async function GET() {
  return new Response(JSON.stringify({ ok: true, service: "promagen", stage: 1 }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}




