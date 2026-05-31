import Link from "next/link";

export default function ReceiptNotFound() {
  return (
    <main className="grid min-h-[80vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Receipt</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Not found</h1>
        <p className="mt-3 text-sm text-text-secondary">
          This receipt link is no longer valid. The order may have been cancelled, or the link was mistyped.
        </p>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90">
          Visit 1Man.Biz
        </Link>
      </div>
    </main>
  );
}
