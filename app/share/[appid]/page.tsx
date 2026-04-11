import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ShareGamePrices from "@/components/ShareGamePrices";

const STEAM_COUNTRY = process.env.STEAM_COUNTRY ?? "BR";
const STEAM_LANGUAGE = process.env.STEAM_LANGUAGE ?? "portuguese";

async function getGameDetails(appid: string) {
  const url =
    `https://store.steampowered.com/api/appdetails` +
    `?appids=${appid}&cc=${STEAM_COUNTRY}&l=${STEAM_LANGUAGE}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const data = await res.json();
  const appData = data[appid]?.data;
  if (!appData) return null;

  return {
    appid,
    name: appData.name as string,
    img: appData.header_image as string,
  };
}

export default async function SharePage({ params }: { params: Promise<{ appid: string }> }) {
  const { appid } = await params;

  if (!/^\d+$/.test(appid)) notFound();

  const game = await getGameDetails(appid);
  if (!game) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header image */}
        <div className="relative h-52 overflow-hidden rounded-t-xl bg-gray-100 dark:bg-gray-800">
          {game.img ? (
            <Image src={game.img} alt={game.name} fill className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl text-gray-400">🎮</div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 rounded-b-xl border border-gray-200 border-t-0 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h1 className="font-semibold text-xl leading-tight">{game.name}</h1>

          <ShareGamePrices appid={game.appid} name={game.name} />

          {/* Back link */}
          <Link href="/" className="mt-2 text-blue-500 text-sm hover:underline">
            ← Track prices for more games
          </Link>
        </div>
      </div>
    </main>
  );
}
