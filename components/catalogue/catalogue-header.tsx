import { Store } from "lucide-react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function getLogoUrl(path: string | null): string | null {
  if (!path || !SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/business-logos/${path}`;
}

type Props = {
  business: {
    name: string;
    tagline: string | null;
    logo_path: string | null;
  };
};

export function CatalogueHeader({ business }: Props) {
  const logoUrl = getLogoUrl(business.logo_path);

  return (
    <header className="flex flex-col items-center gap-5 text-center">
      <div className="grid size-20 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-surface-muted/80 to-white ring-1 ring-black/[0.06] sm:size-24">
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoUrl}
            alt={business.name}
            className="size-full object-cover"
          />
        ) : (
          <Store size={32} strokeWidth={1.5} className="text-text-muted" />
        )}
      </div>
      <div className="max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {business.name}
        </h1>
        {business.tagline ? (
          <p className="mt-2 text-sm text-text-secondary sm:text-base">
            {business.tagline}
          </p>
        ) : null}
      </div>
    </header>
  );
}
