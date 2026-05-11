"use client";

import { Check, ClipboardCopy, ExternalLink, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findBestPrice } from "@/lib/share";
import { type Game, STORES } from "@/lib/types";

interface Props {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
}

function WhatsAppIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  );
}

export default function ShareModal({ game, isOpen, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    if (dialog) {
      getFocusableElements(dialog)[0]?.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;

      const focusable = getFocusableElements(dialog);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  if (!isOpen || !game) return null;

  const shareUrl = `${window.location.origin}/share/${game.appid}`;

  function handleWhatsApp() {
    if (!game) return;
    const best = findBestPrice(game);

    const storePrices = STORES.map((store) => {
      const price = game.prices[store.id]?.price;
      return `${store.name}: ${price ?? "---"}`;
    }).join("\n");

    const bestLine = best ? `⭐Best price ${best.price} on ${best.platform}!\n\n` : "";

    const text = `Check out ${game.name}!\n\n${bestLine}---\n${storePrices}\n${shareUrl}`;
    const encoded = encodeURIComponent(text).replace(/%20/g, "+");
    window.open(
      `https://api.whatsapp.com/send/?text=${encoded}&type=custom_url&app_absent=0`,
      "_blank",
    );
    onClose();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      onClose();
    }, 1000);
  }

  return createPortal(
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        className="fixed inset-0 z-50 cursor-default bg-black/50"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
      >
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
            <X className="size-4" />
          </button>
        </div>

        <p className="mb-3 break-all rounded-lg bg-gray-50 px-3 py-2 text-gray-500 text-xs dark:bg-gray-800 dark:text-gray-400">
          {shareUrl}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-green-500 px-3 py-1.5 font-medium text-white text-xs transition-colors hover:bg-green-600"
          >
            <WhatsAppIcon />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-700 text-xs transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {copied ? (
              <>
                <Check className="size-3.5" />
                Copied!
              </>
            ) : (
              <>
                <ClipboardCopy className="size-3.5" />
                Copy
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            window.open(shareUrl, "_blank");
            onClose();
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 border-gray-100 border-t pt-3 font-medium text-gray-400 text-sm transition-colors hover:text-gray-900 dark:border-gray-800 dark:hover:text-white"
        >
          <ExternalLink className="size-3.5" />
          View share page
        </button>
      </div>
    </>,
    document.body,
  );
}
