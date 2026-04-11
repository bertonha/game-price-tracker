interface AuthGoogleButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children?: string;
}

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

export default function AuthGoogleButton({
  onClick,
  disabled,
  children = "Continue with Google",
}: AuthGoogleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 font-medium text-sm hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
    >
      <GoogleIcon />
      {children}
    </button>
  );
}
