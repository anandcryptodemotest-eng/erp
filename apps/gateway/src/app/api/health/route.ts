import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "gateway",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}
