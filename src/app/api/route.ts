import { NextResponse } from "next/server";

// GET /api
// Lightweight health-check endpoint. Returns 200 if the server is alive and
// reports the configured runtime info. Used by ops/uptime monitors.
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "agentic-chat",
    version: "0.2.1",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  });
}
