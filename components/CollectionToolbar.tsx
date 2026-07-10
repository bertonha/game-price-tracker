import type { SortOrder } from "@/lib/sort";

interface Props {
  gamesCount: number;
  displayedCount: number;
  hasActiveFilters: boolean;
  refreshing: boolean;
  onRefreshAll: () => void;
  onClearAll: () => void;
  sortOrder: SortOrder;
  onSortOrderChange: (v: SortOrder) => void;
}

export default function CollectionToolbar({
  gamesCount,
  displayedCount,
  hasActiveFilters,
  refreshing,
  onRefreshAll,
  onClearAll,
  sortOrder,
  onSortOrderChange,
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onRefreshAll}
        disabled={!gamesCount || refreshing}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-800"
      >
        Refresh all prices
      </button>
      <button
        type="button"
        onClick={onClearAll}
        disabled={!gamesCount}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-red-600 text-sm transition-colors hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
      >
        Clear list
      </button>
      <select
        value={sortOrder}
        onChange={(e) => onSortOrderChange(e.target.value as SortOrder)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
      >
        <option value="priority">Sort: Priority</option>
        <option value="cheapest">Sort: Cheapest first</option>
        <option value="expensive">Sort: Most expensive first</option>
        <option value="release-newest">Sort: Newest first</option>
        <option value="release-oldest">Sort: Oldest first</option>
      </select>
      {gamesCount > 0 && (
        <span className="ml-auto text-gray-400 text-xs">
          {hasActiveFilters
            ? `${displayedCount} of ${gamesCount} game${gamesCount !== 1 ? "s" : ""}`
            : `${gamesCount} game${gamesCount !== 1 ? "s" : ""} saved`}
        </span>
      )}
    </div>
  );
}
