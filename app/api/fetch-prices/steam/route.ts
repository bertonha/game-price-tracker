import { NextRequest, NextResponse } from "next/server";
import { fetchSteam } from "@/lib/steam";

export async function POST(req: NextRequest) {
  const { name, appid } = (await req.json()) as {
    name?: string;
    appid?: string;
  };
  if (!appid)
    return NextResponse.json({ error: "Missing game appid" }, { status: 400 });
  if (!name)
    return NextResponse.json({ error: "Missing game name" }, { status: 400 });
  const price = await fetchSteam(appid, name);
  return NextResponse.json({ price });
}
