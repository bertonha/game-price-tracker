# Game Price Tracker - Agent Instructions

## 1. Project Overview & Features
A Next.js (App Router) application that compares game prices across **Steam BR**, **Nuuvem**, and **Instant Gaming**, focusing on the LATAM/Brazil region.

**Key Features:**
- **Search & Lookup:** Search by name (Steam autocomplete), Steam URL, or AppID. Steam Wishlist importer.
- **Price Fetching:** Real-time lookup via Steam API, Nuuvem (web scraping/autocomplete API), and Instant Gaming.
- **Data Persistence:** `localStorage` for guests; Supabase Database (`games` and `user_games` tables) for logged-in users to sync across devices.
- **Authentication:** Email/password and Google OAuth using Supabase Auth (`@supabase/ssr`).
- **UI/UX:** Draggable game cards (`@dnd-kit`), Store Filters toggle, Dark mode, per-game/bulk refresh.

## 2. Tech Stack & Toolchain Quirks
- **Framework:** Next.js 16 (App Router), React 19, Tailwind CSS v4.
- **Linting & Formatting:** Uses **Biome**. Do NOT add or use ESLint or Prettier.
- **Testing:** Uses **Vitest** (not Jest). Configured via `vitest.config.ts`.
- **Git Hooks:** Managed via `lefthook`.

## 3. Directory Structure & Key Locations
- `app/api/` - Backend endpoints (`fetch-prices`, `search-games`, `import-steam-wishlist`, `account`).
- `lib/stores/` - **Crucial:** Core logic for scraping and matching game data across stores.
- `lib/supabase/` - Supabase client config and storage helpers (`storage.ts`).
- `lib/types.ts` - Centralized domain models and TypeScript definitions.
- `components/` - Reusable UI components (`GameCard.tsx`, `SearchBar.tsx`, `StoreFilter.tsx`, etc.).
- `supabase/migrations/` - Database schema definitions.
- `proxy.ts` - Authentication guard and session management logic.

## 4. Architectural & Development Conventions

### Scraping & Matching
- **Logic (`lib/stores/match.ts`):** Calculates Jaccard overlap between search queries and store results. Enforces strict subset checking (all query words must be in the title). Excludes DLCs, season passes, and upgrades via regex (`STORE_EXCLUDE`).
- **Nuuvem Fetching:** Fetches by scraping the HTML of the Nuuvem product page directly for the `data-price` JSON attribute. Uses progressive slug matching or the Nuuvem autocomplete API.

### Database & Auth
- **Supabase SSR:** Uses `@supabase/ssr` to securely handle auth sessions across server/client components and API routes.
- **Schema:** 
  - `games`: Shared table storing cached price data (keyed by Steam AppID).
  - `user_games`: Links users to their tracked games for cross-device sync.

### UI Patterns
- **Draggable Cards:** Games can be reordered using `@dnd-kit`.
- **Hydration:** Handled carefully to support both guest (localStorage) and auth (Supabase) states.

## 5. Commands & Workflows
- **Development Server:** `npm run dev` (Accessible at `http://localhost:3000`)
- **Building:** `npm run build` and `npm start`
- **Linting & Type-Check:** `npm run lint` (runs `biome check . && tsc --noEmit`)
- **Formatting:** `npm run format` (runs `biome format --write .`)
- **Testing:** `npm test` or `npm run test` (runs Vitest)
- **Pre-commit Workflow:** Managed via `lefthook`. Pre-commit runs Biome check and typecheck; pre-push runs tests. Always ensure compliance before committing.

## 6. Related Documentation
- `README.md`: Basic setup and environment variable guide.
- `doc/`: Feature specifications and design documents (e.g., `filter-starred-games.md`).
