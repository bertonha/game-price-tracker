"use client";

import { useEffect, useState } from "react";
import type { GamePrices } from "@/lib/types";
import { bestDeal } from "@/lib/utils";
import BestDealBanner from "./BestDealBanner";
import StorePriceList from "./StorePriceList";

interface Props {
  appid: string;
  name: string;
}

export default function ShareGamePrices({ appid, name }: Props) {
  const [prices, setPrices] = useState<Partial<GamePrices>>({});
  const [best, setBest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/fetch-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appid, name }),
        });
        const data = await res.json();
        if (data.prices) {
          setPrices(data.prices);
          setBest(bestDeal(data.prices));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [appid, name]);

  if (loading) {
    return <p className="text-gray-400 text-sm">Loading prices…</p>;
  }

  return (
    <>
      <StorePriceList prices={prices} gameName={name} bestStore={best} />
      {best && <BestDealBanner bestStore={best} />}
    </>
  );
}
