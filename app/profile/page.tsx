"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MISSING_SUPABASE_ENV_ERROR,
  useSupabaseBrowserClient,
} from "@/lib/supabase/browser-auth";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = useSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const displayedError = error || (!supabase ? MISSING_SUPABASE_ENV_ERROR : "");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!supabase) {
        return;
      }

      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.replace("/auth/login?next=/profile");
        return;
      }

      setEmail(user.email ?? "");

      setLoading(false);
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function deleteAccount() {
    if (!confirm("Are you sure? This will permanently delete your account.")) {
      return;
    }

    setError("");
    setNotice("");
    setDeleting(true);

    const res = await fetch("/api/account/delete", {
      method: "POST",
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(payload.error ?? "Could not delete account.");
      setDeleting(false);
      return;
    }

    if (supabase) {
      await supabase.auth.signOut();
    }

    setNotice("Account deleted. Redirecting to login...");
    router.replace("/auth/login");
    router.refresh();
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <Link
          href="/"
          className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Back to tracker
        </Link>
      </div>

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 mb-5">
        <h2 className="text-sm font-medium mb-1">Account</h2>
        <p className="text-sm text-gray-500">Signed in as</p>
        <p className="text-sm mt-1 break-all">{email || "-"}</p>
      </section>

      <section className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
          Delete account
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          This permanently deletes your account and signs you out immediately.
        </p>

        {displayedError && (
          <p className="text-sm text-red-500 mt-3">{displayedError}</p>
        )}
        {notice && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-3">
            {notice}
          </p>
        )}

        <button
          type="button"
          onClick={deleteAccount}
          disabled={loading || deleting}
          className="mt-4 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
        >
          {deleting ? "Deleting account..." : "Delete my account"}
        </button>
      </section>
    </main>
  );
}
