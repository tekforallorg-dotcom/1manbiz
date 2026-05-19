import Link from "next/link";

export default function CatalogueNotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Catalogue not found
      </h1>
      <p className="mt-3 text-sm text-text-secondary">
        This business does not have a public catalogue, or the link is no
        longer active.
      </p>
      <Link
        href="https://1man.biz"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90"
      >
        Visit 1Man.Biz
      </Link>
    </main>
  );
}
