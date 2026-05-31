import { MessageCircle, Package } from "lucide-react";

import { formatNairaFromKobo } from "@/lib/format";
import { getProductImageUrl } from "@/lib/storage";
import { buildWhatsAppLink } from "@/lib/whatsapp";

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
  product: Product;
  businessName: string;
  whatsappNumber: string | null;
};

export function CatalogueCard(props: Props) {
  const product = props.product;
  const businessName = props.businessName;
  const whatsappNumber = props.whatsappNumber;

  const imageUrl = getProductImageUrl(product.image_path);
  const outOfStock = product.stock_quantity === 0;

  const prefilledMessage =
    "Hi " + businessName + ", I would like to order " + product.name +
    " (" + formatNairaFromKobo(product.price_kobo) + "). Is it available?";

  const whatsappLink =
    !outOfStock && whatsappNumber
      ? buildWhatsAppLink(whatsappNumber, prefilledMessage)
      : null;

  const cardClasses = outOfStock
    ? "group flex flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-white to-surface-muted/40 ring-1 ring-black/[0.05] opacity-70"
    : "group flex flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-white to-surface-muted/40 ring-1 ring-black/[0.05] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.12)] hover:ring-black/[0.08]";

  const imgClasses = outOfStock
    ? "size-full object-cover grayscale"
    : "size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]";

  return (
    <article className={cardClasses}>
      <div className="relative m-2 aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-surface-muted/60 via-white to-surface-muted/30 ring-1 ring-black/[0.03]">
        {imageUrl ? (
          <img src={imageUrl} alt={product.name} loading="lazy" className={imgClasses} />
        ) : (
          <div className="grid size-full place-items-center text-text-muted">
            <Package size={28} strokeWidth={1.25} />
          </div>
        )}

        {outOfStock ? (
          <div className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-black/[0.04] backdrop-blur-sm">
            Out of stock
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-3 pb-3 pt-1">
        <h3 className="truncate text-sm font-medium text-foreground">{product.name}</h3>
        <p className="text-sm font-semibold tabular-nums text-foreground">{formatNairaFromKobo(product.price_kobo)}</p>

        {whatsappLink ? (
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-foreground/90">
            <MessageCircle size={12} strokeWidth={2.25} />
            <span>Chat to order</span>
          </a>
        ) : null}

        {!whatsappLink && !outOfStock && !whatsappNumber ? (
          <div className="mt-2 rounded-full bg-surface-muted px-3 py-1.5 text-center text-xs text-text-muted">
            Contact vendor
          </div>
        ) : null}

        {outOfStock ? (
          <div className="mt-2 rounded-full bg-surface-muted px-3 py-1.5 text-center text-xs text-text-muted">
            Not available
          </div>
        ) : null}
      </div>
    </article>
  );
}