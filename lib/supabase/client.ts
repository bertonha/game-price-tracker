import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseEnv } from "@/lib/supabase/config";

let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!client) {
    const env = readSupabaseEnv();
    if (!env) {
      return null;
    }

    const { supabaseUrl, supabaseAnonKey } = env;
    client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return client || null;
}
