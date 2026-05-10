import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchInstantGaming } from "@/lib/stores/instant-gaming";
import { fetchNuuvem } from "@/lib/stores/nuuvem";
import { fetchSteam } from "@/lib/stores/steam";
import { POST } from "./route";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(data), {
        status: init?.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

vi.mock("@/lib/stores/steam", () => ({ fetchSteam: vi.fn() }));
vi.mock("@/lib/stores/nuuvem", () => ({ fetchNuuvem: vi.fn() }));
vi.mock("@/lib/stores/instant-gaming", () => ({ fetchInstantGaming: vi.fn() }));

const mockFetchSteam = vi.mocked(fetchSteam);
const mockFetchNuuvem = vi.mocked(fetchNuuvem);
const mockFetchInstantGaming = vi.mocked(fetchInstantGaming);

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/fetch-prices", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("POST /api/fetch-prices", () => {
  describe("validation", () => {
    it("returns 400 when appid is missing", async () => {
      const res = await POST(makeRequest({ name: "Half-Life 2" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Missing appid" });
    });

    it("returns 400 when name is missing", async () => {
      const res = await POST(makeRequest({ appid: "220" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Missing name" });
    });

    it("returns 400 when body is empty", async () => {
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(400);
    });
  });

  describe("price assembly", () => {
    it("returns prices from all three stores", async () => {
      const steamPrice = { price: "R$ 49,99", url: "https://store.steampowered.com/app/220" };
      const nuuvemPrice = { price: "R$ 39,99", url: "https://nuuvem.com/hl2" };
      const igPrice = { price: "R$ 29,99", url: "https://instant-gaming.com/hl2" };

      mockFetchSteam.mockResolvedValue({
        price: steamPrice,
        releaseDate: "2004-11-16",
        comingSoon: false,
      });
      mockFetchNuuvem.mockResolvedValue(nuuvemPrice);
      mockFetchInstantGaming.mockResolvedValue(igPrice);

      const res = await POST(makeRequest({ appid: "220", name: "Half-Life 2" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.prices.steam).toEqual(steamPrice);
      expect(data.prices.nuuvem).toEqual(nuuvemPrice);
      expect(data.prices["instant-gaming"]).toEqual(igPrice);
      expect(data.releaseDate).toBe("2004-11-16");
      expect(data.comingSoon).toBe(false);
    });

    it("omits a store when its fetcher throws", async () => {
      mockFetchSteam.mockRejectedValue(new Error("timeout"));
      mockFetchNuuvem.mockResolvedValue({ price: "R$ 39,99", url: "https://nuuvem.com/hl2" });
      mockFetchInstantGaming.mockRejectedValue(new Error("not found"));

      const res = await POST(makeRequest({ appid: "220", name: "Half-Life 2" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.prices.steam).toBeUndefined();
      expect(data.prices.nuuvem).toBeDefined();
      expect(data.prices["instant-gaming"]).toBeUndefined();
    });

    it("returns empty prices when all stores fail", async () => {
      mockFetchSteam.mockRejectedValue(new Error("fail"));
      mockFetchNuuvem.mockRejectedValue(new Error("fail"));
      mockFetchInstantGaming.mockRejectedValue(new Error("fail"));

      const res = await POST(makeRequest({ appid: "220", name: "Half-Life 2" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.prices).toEqual({});
    });
  });
});
