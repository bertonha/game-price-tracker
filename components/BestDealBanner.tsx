import { STORES } from "@/lib/types";

export default function BestDealBanner({ bestStore }: { bestStore: string | null }) {
  return (
    <div className="rounded bg-gray-50 px-2 py-1 text-gray-500 text-xs dark:bg-gray-800">
      Best deal:{" "}
      {bestStore ? (
        <strong className="text-emerald-600 dark:text-emerald-400">
          {STORES.find((s) => s.id === bestStore)?.name}
        </strong>
      ) : (
        "N/A"
      )}
    </div>
  );
}
