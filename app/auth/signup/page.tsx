"use client";

import { SubmitEvent, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.35 11.1H12v2.98h5.37c-.23 1.52-1.72 4.47-5.37 4.47a5.98 5.98 0 0 1 0-11.96c2.08 0 3.47.88 4.26 1.64l2.9-2.8C17.32 3.72 14.93 2.75 12 2.75a9.25 9.25 0 1 0 0 18.5c5.33 0 8.87-3.75 8.87-9.03 0-.6-.06-1.03-.15-1.42Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function SignupPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!supabase) {
      setError("Supabase env vars are missing.");
      return;
    }

    setLoading(true);

    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (signupError) {
      setError(signupError.message);
      return;
    }

    setNotice("Account created. Check your email to confirm, then sign in.");
  }

  async function handleGoogleSignUp() {
    setError("");
    setNotice("");

    if (!supabase) {
      setError("Supabase env vars are missing.");
      return;
    }

    setLoading(true);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
        <h1 className="text-2xl font-semibold mb-1">Create account</h1>
        <p className="text-sm text-gray-500 mb-6">
          Save your tracked games to your account.
        </p>

        <form className="space-y-4" onSubmit={handleSignup}>
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
              minLength={6}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400"
            />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {notice && <p className="text-sm text-green-600 dark:text-green-400">{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          <span>OR</span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={loading}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="text-sm text-gray-500 mt-6">
          Already have one?{" "}
          <Link href="/auth/login" className="text-gray-900 dark:text-gray-100 underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
