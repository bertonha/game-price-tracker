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

export default async function SharePage({
  params,
}: {
  params: Promise<{ appid: string }>;
}) {
  const { appid } = await params;

  if (!/^\d+$/.test(appid)) notFound();

  const game = await getGameDetails(appid);
  if (!game) notFound();

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header image */}
        <div className="relative h-52 bg-gray-100 dark:bg-gray-800 rounded-t-xl overflow-hidden">
          {game.img ? (
            <Image
              src={game.img}
              alt={game.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-4xl">
              🎮
            </div>
          )}
        </div>

        {/* Body */}
        <div className="bg-white dark:bg-gray-900 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-xl p-5 flex flex-col gap-4">
          <h1 className="text-xl font-semibold leading-tight">{game.name}</h1>

          <ShareGamePrices appid={game.appid} name={game.name} />

          {/* Back link */}
          <Link href="/" className="text-blue-500 hover:underline text-sm mt-2">
            ← Track prices for more games
          </Link>
        </div>
      </div>
    </main>
  );
}
