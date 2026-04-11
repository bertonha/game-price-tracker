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

  useEffect(() => {
    async function load() {
      const [steamRes, nuuvemRes] = await Promise.allSettled([
        fetch("/api/fetch-prices/steam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, appid }),
        }).then((r) => r.json()),
        fetch("/api/fetch-prices/nuuvem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }).then((r) => r.json()),
      ]);

      const updated: Partial<GamePrices> = {
        steam:
          steamRes.status === "fulfilled" && steamRes.value.price
            ? steamRes.value.price
            : undefined,
        nuuvem:
          nuuvemRes.status === "fulfilled" && nuuvemRes.value.price
            ? nuuvemRes.value.price
            : undefined,
      };

      setPrices(updated);
      setBest(bestDeal(updated));
    }

    load();
  }, [appid, name]);

  return (
    <>
      <StorePriceList prices={prices} gameName={name} bestStore={best} />
      {best && <BestDealBanner bestStore={best} />}
    </>
  );
}
