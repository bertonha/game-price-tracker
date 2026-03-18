import { NextRequest, NextResponse } from "next/server";

const STEAM_COUNTRY = process.env.STEAM_COUNTRY ?? "BR";
const STEAM_LANGUAGE = process.env.STEAM_LANGUAGE ?? "portuguese";

export async function GET(req: NextRequest) {
  const appid = req.nextUrl.searchParams.get("appid")?.trim();
  if (!appid || !/^\d+$/.test(appid)) {
    return NextResponse.json({ error: "Invalid appid" }, { status: 400 });
  }

  try {
    const url =
      `https://store.steampowered.com/api/appdetails` +
      `?appids=${appid}&cc=${STEAM_COUNTRY}&l=${STEAM_LANGUAGE}`;

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok)
      return NextResponse.json({ error: "Steam API error" }, { status: 502 });

    const data = await res.json();
    const appData = data[appid]?.data;
    if (!appData) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json({
      appid,
      name: appData.name as string,
      img: appData.header_image as string,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch game details" },
      { status: 500 },
    );
  }
}
