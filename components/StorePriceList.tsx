import { STORES, StoreId } from "@/lib/types";
import type { GamePrices } from "@/lib/types";
import PriceCell from "./PriceCell";

type Store = (typeof STORES)[number];

interface Props {
  prices: Partial<GamePrices>;
  gameName: string;
  bestStore: string | null;
  stores?: readonly Store[];
}

export default function StorePriceList({
  prices,
  gameName,
  bestStore,
  stores = STORES,
}: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {stores.map((store) => {
        const info = prices[store.id as StoreId];
        const isBest =
          bestStore === store.id && info?.price && info.price !== "N/A";

        return (
          <div key={store.id} className="flex flex-col gap-1">
            {/* Base game row */}
            <div className="flex items-center gap-2 text-xs">
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-white font-semibold flex-shrink-0"
                style={{ background: store.color, fontSize: 9 }}
                aria-hidden="true"
              >
                {store.abbr}
              </span>
              <span className="flex-1 text-gray-500 truncate">
                {store.name}
              </span>
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
                  p
                    ? parseFloat(p.replace(/[^\d.]/g, "").replace(",", "."))
                    : Infinity;
                return parse(a.price) - parse(b.price);
              })
              .map((ed, edIdx) => {
                const shortName =
                  ed.name
                    .replace(new RegExp(`^${gameName}\\s*[-–]?\\s*`, "i"), "")
                    .trim() || ed.name;
                return (
                  <div
                    key={`${ed.name}-${edIdx}`}
                    className="flex items-center gap-2 text-xs pl-7"
                  >
                    <span className="flex-1 text-gray-400 truncate italic">
                      {shortName}
                    </span>
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
