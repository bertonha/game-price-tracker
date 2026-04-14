import { type NextRequest, NextResponse } from "next/server";

async function resolveToSteam64Id(profile: string): Promise<string | null> {
  if (/^\d+$/.test(profile)) {
    return profile;
  }
  // Treat as vanity URL — resolve via Steam community profile XML (no API key required)
  let res: Response;
  try {
    res = await fetch(`https://steamcommunity.com/id/${encodeURIComponent(profile)}?xml=1`, {
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const xml = await res.text();
  const match = xml.match(/<steamID64>(\d+)<\/steamID64>/);
  return match ? match[1] : null;
}

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile")?.trim();

  if (!profile || !/^[\w-]+$/.test(profile)) {
    return NextResponse.json(
      { error: "Invalid Steam profile ID or vanity name." },
      { status: 400 },
    );
  }

  const steamId = await resolveToSteam64Id(profile);

  if (!steamId) {
    return NextResponse.json(
      { error: "Could not resolve Steam profile. Check that the profile is public." },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${steamId}`,
      { cache: "no-store" },
    );
  } catch {
    return NextResponse.json({ error: "Failed to reach Steam. Try again later." }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Could not fetch wishlist. Make sure the profile is public." },
      { status: 400 },
    );
  }

  const data = await res.json();
  const items: { appid: number; priority: number }[] = data?.response?.items ?? [];

  if (!items.length) {
    return NextResponse.json({ error: "Wishlist is empty or private." }, { status: 400 });
  }

  // Sort by priority ascending (Steam's priority: lower = higher on wishlist)
  const appids = items.sort((a, b) => a.priority - b.priority).map((item) => String(item.appid));

  return NextResponse.json({ appids });
}
