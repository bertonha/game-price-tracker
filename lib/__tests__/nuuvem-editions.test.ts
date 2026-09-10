import { describe, expect, it } from "vitest";
import { parseEditionCards } from "@/lib/stores/nuuvem";

/** Trimmed from a real https://www.nuuvem.com/br-pt/item/<slug>/editions response. */
const steamDrm = `<ul class="drm-activation"><li class="drm-activation__item drm-activation--steam"><span>Steam</span></li></ul>`;
const xboxDrm = `<ul class="drm-activation"><li class="drm-activation__item drm-activation--microsoft"><span>Xbox</span></li></ul>`;

function card(name: string, slug: string, priceCents: number, extra = steamDrm) {
  return `
    <a title="${name}" data-action="click-&gt;default-tracker#fireClickedEvent" data-default-tracker-product-tracking-data-param="{&quot;name&quot;:&quot;${name}&quot;,&quot;url&quot;:&quot;https://www.nuuvem.com/br-pt/item/${slug}&quot;}" href="https://www.nuuvem.com/br-pt/item/${slug}">
      <article class="product__available game-card game-card--horizontal" data-product-sku="23157">
        <div class="game-card__content"><div class="game-card__description">
          <h3 class="game-card__product-name">
            ${name}
          </h3>
          ${extra}
          <div class="game-card--mobile"><span class="">
            <div class="mod-price product-price " data-price="{&quot;iv&quot;:${Math.round(priceCents / 100)},&quot;e&quot;:null,&quot;v&quot;:${priceCents}}" data-base-price="{&quot;iv&quot;:397,&quot;e&quot;:null,&quot;v&quot;:39750}">
              <span class="product-price--val"><sup class="currency-symbol">R$ </sup><span class="integer">357</span></span>
            </div>
          </span></div>
        </div></div>
      </article>
    </a>`;
}

const frame = (inner: string) =>
  `<turbo-frame id="editions_product_ace-combat-8-wings-of-theve">
     <div class="product-editions__list" data-controller="default-tracker">${inner}</div>
   </turbo-frame>`;

const BASE = "ACE COMBAT 8: WINGS OF THEVE";

describe("parseEditionCards", () => {
  it("parses a single edition card", () => {
    const html = frame(
      card(`${BASE} Deluxe Edition`, "ace-combat-8-wings-of-theve-deluxe-edition", 35700),
    );
    expect(parseEditionCards(html, BASE)).toEqual([
      {
        name: "Deluxe Edition",
        price: "R$ 357,00",
        url: "https://www.nuuvem.com/br-pt/item/ace-combat-8-wings-of-theve-deluxe-edition",
      },
    ]);
  });

  it("takes the URL from the card's own href", () => {
    // The old parser looked the URL up in a map built from autocomplete hits,
    // so an edition the search never returned was silently dropped.
    const html = frame(card(`${BASE} Premium Edition`, "acp-premium", 40000));
    expect(parseEditionCards(html, BASE)?.[0]?.url).toBe(
      "https://www.nuuvem.com/br-pt/item/acp-premium",
    );
  });

  it("parses several editions and de-duplicates repeated anchors", () => {
    const html = frame(
      card(`${BASE} Deluxe Edition`, "acp-deluxe", 35700) +
        card(`${BASE} Premium Edition`, "acp-premium", 40000) +
        card(`${BASE} Deluxe Edition`, "acp-deluxe", 35700),
    );
    const eds = parseEditionCards(html, BASE);
    expect(eds?.map((e) => e.name)).toEqual(["Deluxe Edition", "Premium Edition"]);
  });

  it("strips the base game name from the edition label", () => {
    const html = frame(card(`${BASE} Deluxe Edition`, "acp-deluxe", 35700));
    expect(parseEditionCards(html, BASE)?.[0]?.name).toBe("Deluxe Edition");
  });

  it("decodes HTML entities in the title", () => {
    const html = frame(card("Tom &amp; Jerry Deluxe Edition", "tj-deluxe", 1000));
    expect(parseEditionCards(html, "Tom & Jerry")?.[0]?.name).toBe("Deluxe Edition");
  });

  it("skips DLC cards", () => {
    const html = frame(card(`${BASE} Season Pass`, "acp-season-pass", 10000));
    expect(parseEditionCards(html, BASE)).toBeUndefined();
  });

  it("skips cards with no price", () => {
    const html = frame(
      `<a title="${BASE} Ghost Edition" href="https://www.nuuvem.com/br-pt/item/ghost"><article class="game-card"></article></a>`,
    );
    expect(parseEditionCards(html, BASE)).toBeUndefined();
  });

  it("ignores anchors that are not product links", () => {
    const html = frame(
      `<a title="Ajuda" href="https://www.nuuvem.com/br-pt/help"><span data-price="{&quot;v&quot;:100}"></span></a>`,
    );
    expect(parseEditionCards(html, BASE)).toBeUndefined();
  });

  it("returns undefined for an empty frame", () => {
    expect(parseEditionCards(frame(""), BASE)).toBeUndefined();
  });

  it("returns undefined for the product page, where the frame is unfilled", () => {
    // The product page ships the frame empty; editions arrive from its src URL.
    const html = `<turbo-frame loading="lazy" id="editions_product_x" src="/br-pt/item/x/editions"></turbo-frame>`;
    expect(parseEditionCards(html, BASE)).toBeUndefined();
  });
});

describe("parseEditionCards — platform filtering", () => {
  // Nuuvem lists the same edition for several storefronts under near-identical
  // names. Steam app 2417610's Xbox edition was being offered as a PC price.
  const MGS = "METAL GEAR SOLID Δ: SNAKE EATER";

  it("keeps the Steam edition and drops the Xbox one", () => {
    const html = frame(
      card(`${MGS} - Digital Deluxe Edition`, "mgs-deluxe-edition", 33990, steamDrm) +
        card(`${MGS} Digital Deluxe Edition`, "mgs-digital-deluxe-edition", 39950, xboxDrm),
    );
    expect(parseEditionCards(html, MGS)).toEqual([
      {
        name: "Digital Deluxe Edition",
        price: "R$ 339,90",
        url: "https://www.nuuvem.com/br-pt/item/mgs-deluxe-edition",
      },
    ]);
  });

  it("returns undefined when every edition is for another platform", () => {
    const html = frame(card(`${MGS} Digital Deluxe Edition`, "mgs-xbox", 39950, xboxDrm));
    expect(parseEditionCards(html, MGS)).toBeUndefined();
  });

  it("keeps a card that declares no DRM at all", () => {
    // Fail open: a markup change should not silently empty the edition list.
    const html = frame(card(`${MGS} Deluxe Edition`, "mgs-deluxe", 33990, ""));
    expect(parseEditionCards(html, MGS)).toHaveLength(1);
  });
});
