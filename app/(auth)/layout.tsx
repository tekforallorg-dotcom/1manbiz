import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-surface-muted">
      <header className="py-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-baseline font-bold tracking-[-0.02em] text-[22px]"
        >
          <span className="text-foreground">1Man</span>
          <span className="text-brand-primary">.Biz</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="py-6 px-4 sm:px-6 lg:px-8 text-center text-[12px] text-text-muted">
        © 2026 1Man.Biz &middot; One system for every business conversation
      </footer>
    </div>
  );
}
