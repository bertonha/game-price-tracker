# Game Price Tracker

Compare game prices across **Steam BR** and **Nuuvem** — focused on the Brazil/LATAM region.

## Features

- Search games by name (with Steam autocomplete), Steam URL, or AppID
- Real-time price lookup from Steam (official API) and Nuuvem (HTTP fetch)
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
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for production

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

| Variable         | Default      | Description                    |
| ---------------- | ------------ | ------------------------------ |
| `STEAM_COUNTRY`  | `BR`         | Country code for Steam pricing |
| `STEAM_LANGUAGE` | `portuguese` | Language for Steam responses   |

## Deployment

The app is deployed on [Vercel](https://vercel.com). Push to `main` to trigger a new deployment.

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

**Nuuvem** — uses plain HTTP `fetch` with browser-like headers. The fetcher builds a slug from the game name, hits the Nuuvem product page directly, parses the `data-price` JSON attribute from the page HTML, and retries with progressively shorter slugs when no match is found.
