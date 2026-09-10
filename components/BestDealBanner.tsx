import { STORES } from "@/lib/types";

interface Props {
  bestStore: string | null;
  /** Percent below Steam's official list price, or null when not comparable. */
  savings?: number | null;
  /** Steam's official list price, struck through beside the savings. */
  steamListPrice?: string | null;
  /** The best deal's price, shown as the discounted price. */
  bestPrice?: string | null;
}

export default function BestDealBanner({ bestStore, savings, steamListPrice, bestPrice }: Props) {
  const showDiscount = savings != null && steamListPrice && bestPrice;

  return (
    <div className="flex items-center gap-2 rounded bg-gray-50 px-2 py-1 text-gray-500 text-xs dark:bg-gray-800">
      <span className="truncate">
        Best deal:{" "}
        {bestStore ? (
          <strong className="text-emerald-600 dark:text-emerald-400">
            {STORES.find((s) => s.id === bestStore)?.name}
          </strong>
        ) : (
          "N/A"
        )}
      </span>
      {showDiscount && (
        <span
          className="ml-auto flex flex-shrink-0 items-stretch overflow-hidden rounded-sm"
          title={`${savings}% below Steam's list price of ${steamListPrice}`}
        >
          <span className="flex items-center bg-[#4c6b22] px-1.5 font-bold text-[#a4d007] text-sm">
            -{savings}%
          </span>
          <span className="flex flex-col items-end justify-center bg-[#1b2838] px-1.5 py-0.5 leading-tight">
            <s className="text-[#738895] text-[9px]">{steamListPrice}</s>
            <span className="text-[#beee11] text-[11px]">{bestPrice}</span>
          </span>
        </span>
      )}
    </div>
  );
}
