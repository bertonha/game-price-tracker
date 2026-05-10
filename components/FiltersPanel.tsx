import StoreFilter from "@/components/StoreFilter";

interface Props {
  activeStores: Set<string>;
  onToggleStore: (id: string) => void;
  showStarredOnly: boolean;
  onShowStarredOnlyChange: (v: boolean) => void;
  savedGamesQuery: string;
  onSavedGamesQueryChange: (v: string) => void;
  filtersOpen: boolean;
  onFiltersOpenChange: (v: boolean) => void;
}

export default function FiltersPanel({
  activeStores,
  onToggleStore,
  showStarredOnly,
  onShowStarredOnlyChange,
  savedGamesQuery,
  onSavedGamesQueryChange,
  filtersOpen,
  onFiltersOpenChange,
}: Props) {
  function handleToggle() {
    const next = !filtersOpen;
    onFiltersOpenChange(next);
    try {
      localStorage.setItem("filtersOpen", String(next));
    } catch {}
  }

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-gray-200 bg-linear-to-br from-gray-50 via-white to-gray-100/70 shadow-sm dark:border-gray-800 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between p-4 text-left"
        aria-expanded={filtersOpen}
      >
        <div>
          <p className="font-semibold text-gray-900 text-sm dark:text-gray-100">
            Refine your collection
          </p>
          <p className="text-gray-500 text-xs dark:text-gray-400">
            Filter by best-deal store, favorites, or search inside your saved games.
          </p>
        </div>
        <svg
          aria-hidden="true"
          className={`ml-3 size-4 shrink-0 text-gray-400 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {filtersOpen && (
        <div className="border-gray-200 border-t p-4 pt-3 dark:border-gray-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <StoreFilter activeStores={activeStores} onToggle={onToggleStore} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 font-medium text-[11px] text-gray-400 uppercase tracking-[0.24em] dark:text-gray-500">
                  Favorites
                </span>
                <button
                  type="button"
                  onClick={() => onShowStarredOnlyChange(false)}
                  aria-pressed={!showStarredOnly}
                  className={`rounded-full border px-3 py-1.5 font-medium text-xs transition-all ${
                    !showStarredOnly
                      ? "border-gray-900 bg-gray-900 text-white shadow-gray-900/15 shadow-sm dark:border-white dark:bg-white dark:text-gray-900"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-800"
                  }`}
                >
                  All games
                </button>
                <button
                  type="button"
                  onClick={() => onShowStarredOnlyChange(true)}
                  aria-pressed={showStarredOnly}
                  className={`rounded-full border px-3 py-1.5 font-medium text-xs transition-all ${
                    showStarredOnly
                      ? "border-gray-900 bg-gray-900 text-white shadow-gray-900/15 shadow-sm dark:border-white dark:bg-white dark:text-gray-900"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-800"
                  }`}
                >
                  Starred only
                </button>
              </div>
            </div>

            <div className="w-full lg:max-w-md">
              <label
                htmlFor="saved-games-filter"
                className="mb-2 block font-medium text-[11px] text-gray-400 uppercase tracking-[0.24em] dark:text-gray-500"
              >
                Search saved games
              </label>
              <div className="relative">
                <input
                  id="saved-games-filter"
                  type="text"
                  value={savedGamesQuery}
                  onChange={(e) => onSavedGamesQueryChange(e.target.value)}
                  placeholder="Find by title or AppID"
                  className="w-full rounded-xl border border-gray-200 bg-white/95 px-4 py-2.5 pr-10 text-gray-900 text-sm shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-100 dark:focus:border-gray-500 dark:focus:ring-gray-800"
                />
                {savedGamesQuery && (
                  <button
                    type="button"
                    onClick={() => onSavedGamesQueryChange("")}
                    className="absolute inset-y-0 right-3 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
                    aria-label="Clear saved games search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
