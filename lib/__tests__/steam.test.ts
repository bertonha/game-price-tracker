import { describe, expect, it } from "vitest";
import { decodeHtml } from "@/lib/stores/steam";

describe("decodeHtml", () => {
  it("decodes &amp;", () => {
    expect(decodeHtml("Tom &amp; Jerry")).toBe("Tom & Jerry");
  });

  it("decodes &lt; and &gt;", () => {
    expect(decodeHtml("&lt;div&gt;")).toBe("<div>");
  });

  it("decodes &quot;", () => {
    expect(decodeHtml("say &quot;hello&quot;")).toBe('say "hello"');
  });

  it("decodes &#39;", () => {
    expect(decodeHtml("it&#39;s")).toBe("it's");
  });

  it("decodes &reg; and &trade;", () => {
    expect(decodeHtml("Hades&reg; II&trade;")).toBe("Hades® II™");
  });

  it("decodes &ndash; and &mdash;", () => {
    expect(decodeHtml("a&ndash;b&mdash;c")).toBe("a–b—c");
  });

  it("leaves plain text unchanged", () => {
    expect(decodeHtml("Half-Life 2")).toBe("Half-Life 2");
  });
});
