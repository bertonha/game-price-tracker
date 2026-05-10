import Link from "next/link";

export default function GuestBanner() {
  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
      <p className="text-blue-800 text-sm dark:text-blue-300">
        Want your games synced across devices?{" "}
        <Link href="/auth/signup" className="font-medium underline underline-offset-2">
          Sign up for free
        </Link>
      </p>
      <Link
        href="/auth/signup"
        className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-white text-xs transition-colors hover:bg-blue-700"
      >
        Sign up
      </Link>
    </div>
  );
}
