import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const steamId = request.nextUrl.searchParams.get("profile")?.trim();

  if (!steamId || !/^\d+$/.test(steamId)) {
    return NextResponse.json({ error: "Invalid Steam64 ID." }, { status: 400 });
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
