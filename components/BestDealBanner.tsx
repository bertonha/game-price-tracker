import { STORES } from "@/lib/types";

export default function BestDealBanner({ bestStore }: { bestStore: string }) {
  return (
    <div className="text-xs bg-gray-50 dark:bg-gray-800 rounded px-2 py-1 text-gray-500">
      Best deal:{" "}
      <strong className="text-emerald-600 dark:text-emerald-400">
        {STORES.find((s) => s.id === bestStore)?.name}
      </strong>
    </div>
  );
}
