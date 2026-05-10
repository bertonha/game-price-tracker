import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(data), {
        status: init?.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

function makeRequest(appid?: string): NextRequest {
  const url =
    appid !== undefined
      ? `http://localhost/api/game-details?appid=${appid}`
      : "http://localhost/api/game-details";
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/game-details", () => {
  describe("validation", () => {
    it("returns 400 when appid is missing", async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Invalid appid" });
    });

    it("returns 400 when appid is non-numeric", async () => {
      const res = await GET(makeRequest("half-life-2"));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Invalid appid" });
    });
  });

  describe("Steam API errors", () => {
    it("returns 502 when Steam API responds with an error status", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const res = await GET(makeRequest("220"));
      expect(res.status).toBe(502);
    });

    it("returns 500 when fetch throws", async () => {
      mockFetch.mockRejectedValue(new Error("network error"));
      const res = await GET(makeRequest("220"));
      expect(res.status).toBe(500);
    });

    it("returns 404 when Steam returns no data for the appid", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ "220": { success: false } }),
      });
      const res = await GET(makeRequest("220"));
      expect(res.status).toBe(404);
    });
  });

  describe("successful response", () => {
    it("returns game name, image, parsed release date and comingSoon flag", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          "220": {
            data: {
              name: "Half-Life 2",
              header_image: "https://cdn.steam/hl2.jpg",
              release_date: { coming_soon: false, date: "Jan 15, 2020" },
            },
          },
        }),
      });

      const res = await GET(makeRequest("220"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.appid).toBe("220");
      expect(data.name).toBe("Half-Life 2");
      expect(data.img).toBe("https://cdn.steam/hl2.jpg");
      expect(data.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(data.comingSoon).toBe(false);
    });

    it("omits releaseDate for vague date strings like '2026'", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          "220": {
            data: {
              name: "Coming Game",
              header_image: "https://cdn.steam/cg.jpg",
              release_date: { coming_soon: true, date: "2026" },
            },
          },
        }),
      });

      const res = await GET(makeRequest("220"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.releaseDate).toBeUndefined();
      expect(data.comingSoon).toBe(true);
    });

    it("omits releaseDate when Steam omits the date field", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          "220": {
            data: {
              name: "Some Game",
              header_image: "https://cdn.steam/sg.jpg",
              release_date: { coming_soon: false },
            },
          },
        }),
      });

      const res = await GET(makeRequest("220"));
      const data = await res.json();

      expect(data.releaseDate).toBeUndefined();
      expect(data.comingSoon).toBe(false);
    });
  });
});
