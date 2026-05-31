import { SectionHeading } from "./section-heading";
import { ConnectorDiagram } from "./connector-diagram";

export function ProductReveal() {
  return (
    <section
      id="product"
      className="relative bg-background py-10 sm:py-16 lg:py-24 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="ONE OPERATING SYSTEM"
          headline="Every channel. One business system."
          subhead="Your customers reach you through every channel they prefer. 1Man.Biz runs them all through one operating system that turns conversations into operations, and operations into growth."
        />

        <div className="mt-10 sm:mt-12 lg:mt-16">
          <ConnectorDiagram />
        </div>
      </div>
    </section>
  );
}
