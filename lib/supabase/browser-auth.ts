"use client";

import { useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const MISSING_SUPABASE_ENV_ERROR =
  "Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY.";

export function useSupabaseBrowserClient(): SupabaseClient | null {
  return useMemo(() => getSupabaseBrowserClient(), []);
}

export function getAuthCallbackUrl(nextPath?: string): string {
  const url = new URL("/auth/callback", window.location.origin);

  if (nextPath) {
    url.searchParams.set("next", nextPath);
  }

  return url.toString();
}

export async function signInWithGoogle(
  supabase: SupabaseClient,
  nextPath?: string,
) {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthCallbackUrl(nextPath),
    },
  });
}
