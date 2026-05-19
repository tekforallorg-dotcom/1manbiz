import { CatalogueCard } from "./catalogue-card";
import { CatalogueEmpty } from "./catalogue-empty";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price_kobo: number;
  currency: string;
  stock_quantity: number;
  image_path: string | null;
};

type Props = {
  products: Product[];
  businessName: string;
  whatsappNumber: string | null;
};

export function CatalogueGrid({
  products,
  businessName,
  whatsappNumber,
}: Props) {
  if (products.length === 0) {
    return <CatalogueEmpty />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
      {products.map((p) => (
        <CatalogueCard
          key={p.id}
          product={p}
          businessName={businessName}
          whatsappNumber={whatsappNumber}
        />
      ))}
    </div>
  );
}
