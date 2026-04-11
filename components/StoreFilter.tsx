"use client";

import { STORES } from "@/lib/types";

interface Props {
  activeStores: Set<string>;
  onToggle: (id: string) => void;
}

export default function StoreFilter({ activeStores, onToggle }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-gray-500 text-xs">Stores:</span>
      {STORES.map((store) => {
        const active = activeStores.has(store.id);
        return (
          <button
            type="button"
            key={store.id}
            onClick={() => onToggle(store.id)}
            className={`rounded-full border px-3 py-1 text-xs transition-all ${
              active
                ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                : "border-gray-300 bg-transparent text-gray-500 hover:border-gray-500 dark:border-gray-600"
            }`}
          >
            {store.name}
          </button>
        );
      })}
    </div>
  );
}
