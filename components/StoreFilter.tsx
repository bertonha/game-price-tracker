"use client";

import { STORES } from "@/lib/types";

interface Props {
  activeStores: Set<string>;
  onToggle: (id: string) => void;
}

export default function StoreFilter({ activeStores, onToggle }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500">Stores:</span>
      {STORES.map((store) => {
        const active = activeStores.has(store.id);
        return (
          <button
            key={store.id}
            onClick={() => onToggle(store.id)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${
              active
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
                : "bg-transparent text-gray-500 border-gray-300 dark:border-gray-600 hover:border-gray-500"
            }`}
          >
            {store.name}
          </button>
        );
      })}
    </div>
  );
}
