import Link from "next/link";

interface Props {
  isLoggedIn: boolean;
  onSignOut: () => void;
}

export default function PageHeader({ isLoggedIn, onSignOut }: Props) {
  return (
    <div className="mb-6">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h1 className="font-medium text-2xl">Game Price Tracker</h1>
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <Link
                href="/profile"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
      <p className="text-gray-500 text-sm">
        Compare prices across Steam BR, Nuuvem &amp; Instant Gaming
      </p>
    </div>
  );
}
