import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // try importing only one helper
  await import("./tools/web-search");
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
