"use client";

import Link from "next/link";
import { type SubmitEvent, useState } from "react";
import AuthGoogleButton from "@/components/AuthGoogleButton";
import AuthPageFrame from "@/components/AuthPageFrame";
import {
  getAuthCallbackUrl,
  MISSING_SUPABASE_ENV_ERROR,
  signInWithGoogle,
  useSupabaseBrowserClient,
} from "@/lib/supabase/browser-auth";

export default function SignupPage() {
  const supabase = useSupabaseBrowserClient();
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
      setError(MISSING_SUPABASE_ENV_ERROR);
      return;
    }

    setLoading(true);

    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
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
      setError(MISSING_SUPABASE_ENV_ERROR);
      return;
    }

    setLoading(true);

    const { error: oauthError } = await signInWithGoogle(supabase);

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <AuthPageFrame
      title="Create account"
      description="Save your tracked games to your account."
      footer={
        <>
          Already have one?{" "}
          <Link href="/auth/login" className="text-gray-900 underline dark:text-gray-100">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSignup}>
        <label className="block">
          <span className="text-gray-600 text-sm dark:text-gray-300">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700"
          />
        </label>

        <label className="block">
          <span className="text-gray-600 text-sm dark:text-gray-300">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700"
          />
        </label>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {notice && <p className="text-green-600 text-sm dark:text-green-400">{notice}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gray-900 py-2.5 font-medium text-sm text-white disabled:opacity-60 dark:bg-white dark:text-gray-900"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-gray-400 text-xs">
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        <span>OR</span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>

      <AuthGoogleButton onClick={handleGoogleSignUp} disabled={loading} />
    </AuthPageFrame>
  );
}
