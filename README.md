# Game Price Tracker

Compare game prices across **Steam BR** and **Nuuvem** — focused on the Brazil/LATAM region.

## Features

- Search games by name (with Steam autocomplete), Steam URL, or AppID
- Real-time price lookup from Steam (official API) and Nuuvem (headless browser)
- Per-game refresh and bulk "refresh all" controls
- Prices and game list persisted in `localStorage`
- Dark mode support

## Getting Started

### 1. Clone / unzip the project

```bash
cd game-price-tracker
```

### 2. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 3. Install Playwright system dependencies

**Arch Linux:**
```bash
sudo pacman -S nss nspr alsa-lib libxcomposite libxdamage libxfixes libxrandr libxkbcommon at-spi2-core cups libdrm mesa
```

```bash
npx playwright install-deps chromium
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for production

```bash
npm run build
npm start
```

## Environment Variables

All variables are optional. Copy `.env.local.example` if it exists, or create `.env.local`:

```env
STEAM_COUNTRY=BR
STEAM_LANGUAGE=portuguese
```

| Variable | Default | Description |
|---|---|---|
| `STEAM_COUNTRY` | `BR` | Country code for Steam pricing |
| `STEAM_LANGUAGE` | `portuguese` | Language for Steam responses |

## Project Structure

```
game-price-tracker/
├── app/
│   ├── api/
│   │   ├── search-games/route.ts   # Steam autocomplete proxy
│   │   ├── game-details/route.ts   # Steam AppID lookup
│   │   └── fetch-prices/route.ts   # Price fetcher (Steam API + Playwright)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                    # Main page
├── components/
│   ├── GameCard.tsx                # Per-game price card
│   ├── SearchBar.tsx               # Search input with autocomplete
│   └── StoreFilter.tsx             # Store toggle chips
├── lib/
│   ├── types.ts                    # Shared TypeScript types
│   ├── storage.ts                  # localStorage helpers
│   └── utils.ts                    # Utility functions
└── README.md
```

## How Prices Are Fetched

**Steam** — uses the public `store.steampowered.com/api/appdetails` endpoint. No key required.

**Nuuvem** — uses a Playwright headless Chromium browser, since Nuuvem is a JS-rendered SPA with no public API. A single browser process is reused across requests to avoid cold-start overhead. The scraper navigates to the search results page, extracts the price from the first matching game card, then clicks through to capture the product URL.
