import type { ReactNode } from "react";

interface AuthPageFrameProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthPageFrame({
  title,
  description,
  children,
  footer,
}: AuthPageFrameProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-1 font-semibold text-2xl">{title}</h1>
        <p className="mb-6 text-gray-500 text-sm">{description}</p>
        {children}
        {footer && <div className="mt-6 text-gray-500 text-sm">{footer}</div>}
      </div>
    </main>
  );
}
