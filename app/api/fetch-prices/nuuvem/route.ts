import { type NextRequest, NextResponse } from "next/server";
import { fetchNuuvem } from "@/lib/stores/nuuvem";

export async function POST(req: NextRequest) {
  const { name } = (await req.json()) as { name?: string };
  if (!name) return NextResponse.json({ error: "Missing game name" }, { status: 400 });
  const price = await fetchNuuvem(name);
  return NextResponse.json({ price });
}
