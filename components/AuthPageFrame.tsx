import type { ReactNode } from "react";

interface AuthPageFrameProps {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

export default function AuthPageFrame({
  title,
  description,
  children,
  footer,
}: AuthPageFrameProps) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-1">{title}</h1>
        <p className="text-sm text-gray-500 mb-6">{description}</p>
        {children}
        <div className="text-sm text-gray-500 mt-6">{footer}</div>
      </div>
    </main>
  );
}
