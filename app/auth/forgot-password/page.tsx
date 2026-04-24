"use client";

import Link from "next/link";
import { type SubmitEvent, useState } from "react";
import AuthPageFrame from "@/components/AuthPageFrame";
import {
  getAuthCallbackUrl,
  MISSING_SUPABASE_ENV_ERROR,
  useSupabaseBrowserClient,
} from "@/lib/supabase/browser-auth";

export default function ForgotPasswordPage() {
  const supabase = useSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!supabase) {
      setError(MISSING_SUPABASE_ENV_ERROR);
      return;
    }

    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthCallbackUrl(),
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setNotice("Check your email for a password reset link.");
  }

  return (
    <AuthPageFrame
      title="Reset password"
      description="We'll send you a link to reset your password."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/auth/login" className="text-gray-900 underline dark:text-gray-100">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
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

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {notice && <p className="text-green-600 text-sm dark:text-green-400">{notice}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gray-900 py-2.5 font-medium text-sm text-white disabled:opacity-60 dark:bg-white dark:text-gray-900"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </AuthPageFrame>
  );
}
