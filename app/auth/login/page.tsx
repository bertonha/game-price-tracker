"use client";

import { SubmitEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [nextPath, setNextPath] = useState("/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/";
    const callbackError = params.get("error");
    setNextPath(next);

    if (callbackError === "oauth_callback") {
      setError("Could not complete OAuth sign in. Please try again.");
    }

    const supabaseClient = supabase;

    if (!supabaseClient) {
      setError("Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY.");
      return () => {
        active = false;
      };
    }

    async function checkSession(client: NonNullable<typeof supabaseClient>) {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (active && session) {
        router.replace(next);
      }
    }

    checkSession(supabaseClient);

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleLogin(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!supabase) {
      setError("Supabase env vars are missing.");
      return;
    }

    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError("");

    if (!supabase) {
      setError("Supabase env vars are missing.");
      return;
    }

    setLoading(true);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-gray-500 mb-6">
          Access your tracked games from any device.
        </p>

        <form className="space-y-4" onSubmit={handleLogin}>
          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400"
            />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          <span>OR</span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <p className="text-sm text-gray-500 mt-6">
          No account yet?{" "}
          <Link href="/auth/signup" className="text-gray-900 dark:text-gray-100 underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
