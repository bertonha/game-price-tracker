# Game Price Tracker

Compare game prices across **Steam BR** and **Nuuvem** — focused on the Brazil/LATAM region.

## Features

- Search games by name (with Steam autocomplete), Steam URL, or AppID
- Real-time price lookup from Steam (official API) and Nuuvem (HTTP fetch)
- Per-game refresh and bulk "refresh all" controls
- Email/password and Google login with Supabase Auth
- Prices and game list persisted locally (database persistence is the next step)
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

Copy `.env.local.example` to `.env.local` and fill values:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
```

| Variable                                       | Default      | Description                              |
| ---------------------------------------------- | ------------ | ---------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                     | —            | Supabase project URL (required for auth) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | —            | Supabase anon key (required for auth)    |
| `STEAM_COUNTRY`                                | `BR`         | Country code for Steam pricing           |
| `STEAM_LANGUAGE`                               | `portuguese` | Language for Steam responses             |

## Authentication

- The main app route (`/`) is protected by a Next.js proxy auth guard.
- Public routes: `/auth/login`, `/auth/signup`, `/auth/callback`, and `/share/[appid]`.
- Sign in options currently implemented: email/password and Google OAuth.
- To enable Google OAuth, configure the Google provider in Supabase and set callback URL to `http://localhost:3000/auth/callback` for local development.

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
