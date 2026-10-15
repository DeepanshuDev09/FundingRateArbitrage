import { NextResponse } from "next/server";
import { getRatesSnapshot } from "@/lib/rates";

export const runtime = "nodejs";
export const maxDuration = 20;
export const revalidate = 30;

export async function GET(request: Request) {
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
  const snapshot = await getRatesSnapshot(forceRefresh);

  return NextResponse.json(snapshot, {
    headers: forceRefresh
      ? { "Cache-Control": "no-store" }
      : { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" },
  });
}
