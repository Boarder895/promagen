export const dynamic = "force-dynamic";
type Meta = { name: string; version: string; env: "development" | "production" | "test"; time: string; };
export async function GET(): Promise<Response> {
  const meta: Meta = { name: "promagen-frontend", version: "0.1.0", env: (process.env.NODE_ENV as Meta["env"]) ?? "development", time: new Date().toISOString() };
  return Response.json(meta, { status: 200 });
}

