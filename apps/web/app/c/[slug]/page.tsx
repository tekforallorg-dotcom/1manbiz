import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { CatalogueHeader } from "@/components/catalogue/catalogue-header";
import { CatalogueGrid } from "@/components/catalogue/catalogue-grid";
import { CataloguePaused } from "@/components/catalogue/catalogue-paused";

export const dynamic = "force-dynamic";

type Params = { slug: string };

type CatalogueProduct = {
  id: string;
  name: string;
  sku: string | null;
  price_kobo: number;
  currency: string;
  stock_quantity: number;
  image_path: string | null;
};

type CatalogueBusiness = {
  name: string;
  tagline: string | null;
  logo_path: string | null;
  whatsapp_number: string | null;
};

type CatalogueData =
  | null
  | {
      status: "active";
      business: CatalogueBusiness;
      products: CatalogueProduct[];
    }
  | {
      status: "paused";
      business: { name: string; logo_path: string | null };
    };

async function fetchCatalogue(slug: string): Promise<CatalogueData> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_catalogue", {
    slug_input: slug,
  });
  if (error) {
    console.error("[catalogue] RPC error", error);
    return null;
  }
  return data as CatalogueData;
}

export async function generateMetadata(args: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await args.params;
  const data = await fetchCatalogue(slug);

  if (!data) {
    return {
      title: "Catalogue not found",
      robots: { index: false },
    };
  }

  const businessName = data.business.name;

  if (data.status === "paused") {
    return {
      title: businessName,
      description: businessName + " is currently unavailable.",
      robots: { index: false },
    };
  }

  const tagline = data.business.tagline;
  const description = tagline ?? ("Browse and order from " + businessName + " on 1Man.Biz.");

  return {
    title: businessName + " - Catalogue",
    description: description,
    openGraph: {
      title: businessName,
      description: description,
      type: "website",
    },
  };
}

function PoweredByFooter() {
  return (
    <footer className="mt-16 flex items-center justify-center border-t border-black/[0.06] pt-8">
      <a href="https://1man.biz" target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted transition-colors hover:text-text-secondary">
        <span>Powered by 1Man</span>
        <span className="text-brand-primary">.Biz</span>
      </a>
    </footer>
  );
}

export default async function CataloguePage(args: {
  params: Promise<Params>;
}) {
  const { slug } = await args.params;
  const data = await fetchCatalogue(slug);

  if (!data) notFound();

  if (data.status === "paused") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <CataloguePaused business={data.business} />
        <PoweredByFooter />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 pb-12 sm:px-6 sm:py-14 sm:pb-16">
      <CatalogueHeader business={data.business} />
      <div className="mt-10 sm:mt-14">
        <CatalogueGrid products={data.products} businessName={data.business.name} whatsappNumber={data.business.whatsapp_number} />
      </div>
      <PoweredByFooter />
    </main>
  );
}