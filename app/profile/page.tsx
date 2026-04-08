"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MISSING_SUPABASE_ENV_ERROR,
  useSupabaseBrowserClient,
  updatePassword,
} from "@/lib/supabase/browser-auth";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = useSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
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

  async function updatePasswordHandler(
    e: React.SyntheticEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    if (!supabase) {
      setPasswordError(MISSING_SUPABASE_ENV_ERROR);
      return;
    }

    setPasswordError("");
    setPasswordNotice("");

    // Validate passwords
    if (!passwordForm.newPassword) {
      setPasswordError("New password is required.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordLoading(true);

    const { error: updateError } = await updatePassword(
      supabase,
      passwordForm.newPassword,
    );

    if (updateError) {
      setPasswordError(updateError.message || "Failed to update password.");
      setPasswordLoading(false);
      return;
    }

    setPasswordNotice("Password updated successfully!");
    setPasswordForm({ newPassword: "", confirmPassword: "" });
    setPasswordFormOpen(false);
    setPasswordLoading(false);

    // Clear notice after 3 seconds
    setTimeout(() => setPasswordNotice(""), 3000);
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

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium mb-1">Password</h2>
            <p className="text-sm text-gray-500">
              Change your account password
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPasswordFormOpen(!passwordFormOpen)}
            disabled={loading}
            className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {passwordFormOpen ? "Cancel" : "Change"}
          </button>
        </div>

        {passwordFormOpen && (
          <form onSubmit={updatePasswordHandler} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                New password
              </label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    newPassword: e.target.value,
                  })
                }
                placeholder="Enter new password"
                disabled={passwordLoading}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Confirm password
              </label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Confirm new password"
                disabled={passwordLoading}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>

            {passwordError && (
              <p className="text-sm text-red-500">{passwordError}</p>
            )}

            {passwordNotice && (
              <p className="text-sm text-green-600 dark:text-green-400">
                {passwordNotice}
              </p>
            )}

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {passwordLoading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
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
