import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ service: "procurement", status: "healthy", timestamp: new Date().toISOString() });
}
