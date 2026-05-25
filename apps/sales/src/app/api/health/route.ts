import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ service: "sales", status: "healthy", timestamp: new Date().toISOString() });
}
