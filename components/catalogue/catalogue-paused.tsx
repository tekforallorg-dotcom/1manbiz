import { Store } from "lucide-react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function getLogoUrl(path: string | null): string | null {
  if (!path || !SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/business-logos/${path}`;
}

type Props = {
  business: {
    name: string;
    logo_path: string | null;
  };
};

export function CataloguePaused({ business }: Props) {
  const logoUrl = getLogoUrl(business.logo_path);

  return (
    <div className="mx-auto max-w-md rounded-3xl bg-white p-10 text-center ring-1 ring-black/[0.04]">
      <div className="mx-auto grid size-16 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-surface-muted/80 to-white ring-1 ring-black/[0.06]">
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={logoUrl} alt={business.name} className="size-full object-cover" />
        ) : (
          <Store size={28} strokeWidth={1.5} className="text-text-muted" />
        )}
      </div>
      <h1 className="mt-6 text-xl font-semibold text-foreground">
        {business.name}
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        This catalogue is temporarily unavailable. Please check back later.
      </p>
    </div>
  );
}
