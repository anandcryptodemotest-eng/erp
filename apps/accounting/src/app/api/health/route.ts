import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ service: "accounting", status: "healthy", timestamp: new Date().toISOString() });
}
