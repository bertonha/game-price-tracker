"use client";

import { STORES } from "@/lib/types";

interface Props {
  activeStores: Set<string>;
  onToggle: (id: string) => void;
}

export default function StoreFilter({ activeStores, onToggle }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 font-medium text-[11px] text-gray-400 uppercase tracking-[0.24em] dark:text-gray-500">
        Best deal store
      </span>
      {STORES.map((store) => {
        const active = activeStores.has(store.id);
        return (
          <button
            type="button"
            key={store.id}
            onClick={() => onToggle(store.id)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1.5 font-medium text-xs transition-all ${
              active
                ? "border-gray-900 bg-gray-900 text-white shadow-gray-900/15 shadow-sm dark:border-white dark:bg-white dark:text-gray-900"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-800"
            }`}
          >
            {store.name}
          </button>
        );
      })}
    </div>
  );
}
