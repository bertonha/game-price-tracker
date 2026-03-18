import { NextRequest, NextResponse } from "next/server";

const STEAM_COUNTRY = process.env.STEAM_COUNTRY ?? "BR";
const STEAM_LANGUAGE = process.env.STEAM_LANGUAGE ?? "portuguese";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url =
      `https://store.steampowered.com/search/suggest` +
      `?term=${encodeURIComponent(query)}&f=games` +
      `&cc=${STEAM_COUNTRY}&l=${STEAM_LANGUAGE}&v=1`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GamePriceTracker/1.0)",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) return NextResponse.json({ results: [] });

    const html = await res.text();

    // Parse the HTML suggestions returned by Steam
    const results: { appid: string; name: string; img: string }[] = [];
    const matchRegex =
      /data-ds-appid="(\d+)"[^>]*>[\s\S]*?<div[^>]+class="match_name"[^>]*>([^<]+)<\/div>[\s\S]*?<img[^>]+src="([^"]+)"/g;

    let m: RegExpExecArray | null;
    while ((m = matchRegex.exec(html)) !== null && results.length < 8) {
      results.push({ appid: m[1]!, name: m[2]!.trim(), img: m[3]! });
    }

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
