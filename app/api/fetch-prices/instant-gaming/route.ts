import { NextRequest, NextResponse } from "next/server";
import { fetchInstantGaming } from "@/lib/stores/instant-gaming";

export async function POST(req: NextRequest) {
  const { name } = (await req.json()) as { name?: string };
  if (!name)
    return NextResponse.json({ error: "Missing game name" }, { status: 400 });
  const price = await fetchInstantGaming(name);
  return NextResponse.json({ price });
}
