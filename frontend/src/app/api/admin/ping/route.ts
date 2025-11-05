import { NextResponse } from "next/server";

// Simple health ping used by Stage 1 status checks.
export async function GET() {
  // Return 204 No Content; nothing to parse, but proves the route is alive.
  return new NextResponse(null, { status: 204 });
}












