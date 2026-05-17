import { SiteNav } from "@/components/site/site-nav";
import { SiteHero } from "@/components/site/site-hero";
import { ProblemSection } from "@/components/site/problem-section";
import { ProductReveal } from "@/components/site/product-reveal";
import { FeaturesSection } from "@/components/site/features-section";
import { WorkflowSection } from "@/components/site/workflow-section";
import { PersonasSection } from "@/components/site/personas-section";
import { PricingSection } from "@/components/site/pricing-section";
import { FinalCTA } from "@/components/site/final-cta";
import { SiteFooter } from "@/components/site/site-footer";

/**
 * Landing page — full marketing site to footer.
 * Section order designed for narrative flow:
 *   Hero → Problem → Solution glance (Product Reveal) → Features (deep) →
 *   Workflow (how) → Personas (who) → Pricing (how much) → Final CTA → Footer
 */
export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <SiteHero />
        <ProblemSection />
        <ProductReveal />
        <FeaturesSection />
        <WorkflowSection />
        <PersonasSection />
        <PricingSection />
        <FinalCTA />
      </main>
      <SiteFooter />
    </>
  );
}
