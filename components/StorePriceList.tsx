import type { GamePrices } from "@/lib/types";
import { STORES, type StoreId } from "@/lib/types";
import PriceCell from "./PriceCell";

type Store = (typeof STORES)[number];

interface Props {
  prices: Partial<GamePrices>;
  gameName: string;
  bestStore: string | null;
  stores?: readonly Store[];
}

export default function StorePriceList({ prices, gameName, bestStore, stores = STORES }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {stores.map((store) => {
        const info = prices[store.id as StoreId];
        const isBest = bestStore === store.id && info?.price && info.price !== "N/A";

        return (
          <div key={store.id} className="flex flex-col gap-1">
            {/* Base game row */}
            <div className="flex items-center gap-2 text-xs">
              <span
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded font-semibold text-white"
                style={{ background: store.color, fontSize: 9 }}
                aria-hidden="true"
              >
                {store.abbr}
              </span>
              <span className="flex-1 truncate text-gray-500">{store.name}</span>
              {!info ? (
                <span className="text-gray-400 italic">checking…</span>
              ) : !info.price || info.price === "N/A" ? (
                <span className="text-gray-400">N/A</span>
              ) : (
                <PriceCell
                  price={info.price}
                  url={info.url}
                  isBest={!!isBest}
                  storeName={store.name}
                  gameName={gameName}
                />
              )}
            </div>
            {/* Edition sub-rows — sorted by price ascending */}
            {info?.editions
              ?.slice()
              .sort((a, b) => {
                const parse = (p: string | null) =>
                  p ? parseFloat(p.replace(/[^\d.]/g, "").replace(",", ".")) : Infinity;
                return parse(a.price) - parse(b.price);
              })
              .map((ed) => {
                const shortName =
                  ed.name.replace(new RegExp(`^${gameName}\\s*[-–]?\\s*`, "i"), "").trim() ||
                  ed.name;
                return (
                  <div key={ed.name} className="flex items-center gap-2 pl-7 text-xs">
                    <span className="flex-1 truncate text-gray-400 italic">{shortName}</span>
                    {!ed.price || ed.price === "N/A" ? (
                      <span className="text-gray-400">N/A</span>
                    ) : (
                      <PriceCell
                        price={ed.price}
                        url={ed.url}
                        isBest={false}
                        storeName={store.name}
                        gameName={`${gameName} ${shortName}`}
                      />
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
