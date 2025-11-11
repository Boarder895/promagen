export async function GET() {
  return new Response(JSON.stringify({ ok: false, error: "Not implemented" }), {
    status: 501,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
