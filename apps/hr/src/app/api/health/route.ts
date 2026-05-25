import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ service: "hr", status: "healthy", timestamp: new Date().toISOString() });
}
