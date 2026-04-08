"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { SteamSuggestion } from "@/lib/types";

interface Props {
  onAdd: (
    game: SteamSuggestion | { name: string; appid: string; img: string },
  ) => void;
  disabled?: boolean;
}

export default function SearchBar({ onAdd, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SteamSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    // Don't autocomplete if it looks like a URL or appid
    if (
      /store\.steampowered\.com\/app\/\d+/.test(val) ||
      /^\d{4,8}$/.test(val.trim())
    ) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search-games?q=${encodeURIComponent(val)}`,
        );
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function pickSuggestion(g: SteamSuggestion) {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    onAdd(g);
  }

  async function handleSubmit() {
    const val = query.trim();
    if (!val || disabled) return;
    setLoading(true);
    setShowSuggestions(false);

    // Steam URL or AppID
    const appUrlMatch = val.match(/store\.steampowered\.com\/app\/(\d+)/);
    const appidDirect = /^\d{4,8}$/.test(val) ? val : null;
    const appid = appUrlMatch?.[1] ?? appidDirect;

    if (appid) {
      try {
        const res = await fetch(`/api/game-details?appid=${appid}`);
        const data = await res.json();
        if (data.name) {
          onAdd(data);
          setQuery("");
        } else alert("Game not found for that AppID.");
      } catch {
        alert("Failed to look up game.");
      }
    } else {
      // Use first suggestion, or fetch one if not yet loaded
      const first = suggestions[0];
      if (suggestions.length > 0 && first) {
        pickSuggestion(first);
      } else {
        try {
          const res = await fetch(
            `/api/search-games?q=${encodeURIComponent(val)}`,
          );
          const data = await res.json();
          const top: SteamSuggestion | undefined = data.results?.[0];
          if (top) {
            pickSuggestion(top);
          } else {
            alert("No Steam game found for that name.");
          }
        } catch {
          alert("Failed to search for that game.");
        }
      }
    }
    setLoading(false);
  }

  return (
    <div ref={wrapRef} className="relative flex gap-2">
      <div className="relative flex-1 min-w-0">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") setShowSuggestions(false);
          }}
          placeholder="Game name, Steam URL, or AppID…"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={disabled}
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg z-20 overflow-hidden shadow-lg">
            {suggestions.map((g) => (
              <li key={g.appid}>
                <button
                  onMouseDown={() => pickSuggestion(g)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {g.img && (
                    <Image
                      src={g.img}
                      alt=""
                      width={40}
                      height={25}
                      style={{ height: "auto" }}
                      className="rounded flex-shrink-0"
                      unoptimized
                    />
                  )}
                  <span className="truncate text-gray-800 dark:text-gray-200">
                    {g.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || loading || !query.trim()}
        className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-85 disabled:opacity-40 transition-opacity whitespace-nowrap"
      >
        {loading ? "Adding…" : "Add game"}
      </button>
    </div>
  );
}
