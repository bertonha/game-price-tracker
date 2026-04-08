"use client";

import { SubmitEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGoogleButton from "@/components/AuthGoogleButton";
import AuthPageFrame from "@/components/AuthPageFrame";
import {
  MISSING_SUPABASE_ENV_ERROR,
  signInWithGoogle,
  useSupabaseBrowserClient,
} from "@/lib/supabase/browser-auth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nextPath = searchParams.get("next") || "/";
  const callbackError = searchParams.get("error");
  const displayedError =
    error ||
    (!supabase ? MISSING_SUPABASE_ENV_ERROR : "") ||
    (callbackError === "oauth_callback"
      ? "Could not complete OAuth sign in. Please try again."
      : "");

  useEffect(() => {
    let active = true;

    const supabaseClient = supabase;

    if (!supabaseClient) {
      return () => {
        active = false;
      };
    }

    async function checkSession(client: NonNullable<typeof supabaseClient>) {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (active && session) {
        router.replace(nextPath);
      }
    }

    checkSession(supabaseClient);

    return () => {
      active = false;
    };
  }, [nextPath, router, supabase]);

  async function handleLogin(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!supabase) {
      setError(MISSING_SUPABASE_ENV_ERROR);
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
      setError(MISSING_SUPABASE_ENV_ERROR);
      return;
    }

    setLoading(true);

    const { error: oauthError } = await signInWithGoogle(supabase, nextPath);

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <AuthPageFrame
      title="Sign in"
      description="Access your tracked games from any device."
      footer={
        <>
          No account yet?{" "}
          <Link
            href="/auth/signup"
            className="text-gray-900 dark:text-gray-100 underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleLogin}>
        <label className="block">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400"
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400"
          />
        </label>

        {displayedError && (
          <p className="text-sm text-red-500">{displayedError}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-gray-900"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        <span>OR</span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>

      <AuthGoogleButton onClick={handleGoogleSignIn} disabled={loading} />
    </AuthPageFrame>
  );
}
