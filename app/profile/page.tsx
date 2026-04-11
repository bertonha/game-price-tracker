"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MISSING_SUPABASE_ENV_ERROR,
  updatePassword,
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

  async function updatePasswordHandler(e: React.SyntheticEvent<HTMLFormElement>) {
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

    const { error: updateError } = await updatePassword(supabase, passwordForm.newPassword);

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
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-semibold text-2xl">Profile</h1>
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Back to tracker
        </Link>
      </div>

      <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-1 font-medium text-sm">Account</h2>
        <p className="text-gray-500 text-sm">Signed in as</p>
        <p className="mt-1 break-all text-sm">{email || "-"}</p>
      </section>

      <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="mb-1 font-medium text-sm">Password</h2>
            <p className="text-gray-500 text-sm">Change your account password</p>
          </div>
          <button
            type="button"
            onClick={() => setPasswordFormOpen(!passwordFormOpen)}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            {passwordFormOpen ? "Cancel" : "Change"}
          </button>
        </div>

        {passwordFormOpen && (
          <form onSubmit={updatePasswordHandler} className="mt-4 space-y-3">
            <div>
              <label htmlFor="new-password" className="mb-1 block font-medium text-xs">
                New password
              </label>
              <input
                id="new-password"
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
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-1 block font-medium text-xs">
                Confirm password
              </label>
              <input
                id="confirm-password"
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
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>

            {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}

            {passwordNotice && (
              <p className="text-green-600 text-sm dark:text-green-400">{passwordNotice}</p>
            )}

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {passwordLoading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-red-200 bg-white p-5 dark:border-red-900/60 dark:bg-gray-900">
        <h2 className="mb-1 font-medium text-red-700 text-sm dark:text-red-400">Delete account</h2>
        <p className="mb-4 text-gray-500 text-sm">
          This permanently deletes your account and signs you out immediately.
        </p>

        {displayedError && <p className="mt-3 text-red-500 text-sm">{displayedError}</p>}
        {notice && <p className="mt-3 text-green-600 text-sm dark:text-green-400">{notice}</p>}

        <button
          type="button"
          onClick={deleteAccount}
          disabled={loading || deleting}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700 text-sm hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          {deleting ? "Deleting account..." : "Delete my account"}
        </button>
      </section>
    </main>
  );
}
