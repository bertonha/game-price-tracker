"use client";

import { type MouseEvent, useEffect, useState } from "react";
import type { Game, StoreId } from "@/lib/types";

interface Props {
  game: Game;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ game, isOpen, onClose }: Props) {
  const [copiedStore, setCopiedStore] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handleWhatsApp = (
    e: MouseEvent<HTMLButtonElement>,
    url: string | null,
    price: string | null,
    platform: string,
    isBestPrice: boolean,
  ) => {
    e.preventDefault();
    if (!url) return;
    let text: string;
    if (isBestPrice && price) {
      text = `We found the best price on ${platform} for ${game.name} (${price}), check it out!\n${url}`;
    } else if (price) {
      text = `Checkout ${game.name} for ${price} on ${platform}!\n${url}`;
    } else {
      text = `Check out ${game.name} on ${platform}!\n${url}`;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    onClose();
  };

  const handleCopy = async (
    e: MouseEvent<HTMLButtonElement>,
    url: string | null,
    storeName: string,
  ) => {
    e.preventDefault();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedStore(storeName);
    setTimeout(() => {
      setCopiedStore(null);
      onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  const stores: { id: StoreId; name: string; color: string }[] = [
    { id: "steam", name: "Steam BR", color: "#1b2838" },
    { id: "nuuvem", name: "Nuuvem", color: "#e8392b" },
    { id: "instant-gaming", name: "Instant Gaming", color: "#e8a000" },
  ];

  const parsePrice = (priceStr: string | null): number | null => {
    if (!priceStr || priceStr === "N/A") return null;
    const num = parseFloat(priceStr.replace(/[^\d.,]/g, "").replace(",", "."));
    return Number.isNaN(num) ? null : num;
  };

  let bestPrice: { price: string; url: string; platform: string; id: StoreId } | null = null;
  for (const store of stores) {
    const priceInfo = game.prices[store.id];
    if (priceInfo?.price && priceInfo?.url) {
      const parsed = parsePrice(priceInfo.price);
      if (parsed !== null) {
        const bestParsed = bestPrice ? parsePrice(bestPrice.price) : null;
        if (!bestPrice || (bestParsed !== null && parsed < bestParsed)) {
          bestPrice = {
            price: priceInfo.price,
            url: priceInfo.url,
            platform: store.name,
            id: store.id,
          };
        }
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (e.target === e.currentTarget) onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="share-modal-title" className="font-semibold text-gray-900 dark:text-white">
            Share "{game.name}"
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {bestPrice && (
            <div className="flex flex-col gap-2 rounded-lg border-2 border-green-500 bg-green-50 p-3 dark:bg-green-900/20">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded bg-green-500 px-2 py-0.5 font-semibold text-white text-xs">
                  ★ Best Price
                </span>
                <span className="flex-1 font-semibold text-green-700 text-sm dark:text-green-400">
                  {bestPrice.price}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) =>
                    handleWhatsApp(e, bestPrice.url, bestPrice.price, bestPrice.platform, true)
                  }
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-green-500 px-3 py-1.5 font-medium text-white text-xs transition-colors hover:bg-green-600"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={(e) => handleCopy(e, bestPrice.url, "Best Price")}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white px-3 py-1.5 font-medium text-green-700 text-xs transition-colors hover:bg-green-100 dark:bg-green-900/40 dark:text-green-400 dark:hover:bg-green-900/60"
                >
                  {copiedStore === "Best Price" ? (
                    <>
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {stores.map((store) => {
            const priceInfo = game.prices[store.id];
            const url = priceInfo?.url;
            const hasUrl = !!url;

            return (
              <div
                key={store.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-100 p-3 dark:border-gray-800"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded font-semibold text-[9px] text-white"
                    style={{ background: store.color }}
                  >
                    {store.id === "steam" ? "ST" : store.id === "nuuvem" ? "NU" : "IG"}
                  </span>
                  <span className="flex-1 truncate font-medium text-gray-700 text-sm dark:text-gray-200">
                    {store.name}
                  </span>
                  {!hasUrl && <span className="text-gray-400 text-xs">Not available</span>}
                </div>

                {hasUrl && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) =>
                        handleWhatsApp(e, url, priceInfo?.price || null, store.name, false)
                      }
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-green-500 px-3 py-1.5 font-medium text-white text-xs transition-colors hover:bg-green-600"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleCopy(e, url, store.name)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-700 text-xs transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      {copiedStore === store.name ? (
                        <>
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
