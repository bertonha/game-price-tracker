"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import AuthPageFrame from "@/components/AuthPageFrame";
import {
  MISSING_SUPABASE_ENV_ERROR,
  updatePassword,
  useSupabaseBrowserClient,
} from "@/lib/supabase/browser-auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useSupabaseBrowserClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (!supabase) {
      setError(MISSING_SUPABASE_ENV_ERROR);
      return;
    }

    setLoading(true);

    const { error: updateError } = await updatePassword(supabase, password);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <AuthPageFrame title="New password" description="Choose a new password for your account.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-gray-600 text-sm dark:text-gray-300">New password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700"
          />
        </label>

        <label className="block">
          <span className="text-gray-600 text-sm dark:text-gray-300">Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700"
          />
        </label>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gray-900 py-2.5 font-medium text-sm text-white disabled:opacity-60 dark:bg-white dark:text-gray-900"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </AuthPageFrame>
  );
}
