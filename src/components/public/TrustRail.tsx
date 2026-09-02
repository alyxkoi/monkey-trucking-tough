import { ClipboardCheck, MapPin, Truck, type LucideIcon } from "lucide-react";
import PublicReveal from "./PublicReveal";

const proof = [
  { title: "Kaufman, Texas", line: "Local service across Kaufman County and surrounding DFW areas.", icon: MapPin },
  { title: "Materials + Delivery", line: "Aggregate supply, hauling and delivery for your property or job site.", icon: Truck },
  { title: "Upfront Quotes", line: "Send the work and location, then confirm the scope before scheduling.", icon: ClipboardCheck },
];

type TrustRailItem = { title: string; line: string; icon: LucideIcon };

export default function TrustRail({ items = proof }: { items?: TrustRailItem[] }) {
  return (
    <section className="public-proof-section" aria-label="Monkey Trucking service facts">
      <PublicReveal className="public-proof-container">
        <div className="public-proof-grid">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="public-proof-card">
                <span className="public-proof-card-surface" aria-hidden="true" />
                <span className="public-proof-card-fill" aria-hidden="true" />
                <div className="public-proof-card-content">
                  <span className="public-proof-icon" aria-hidden="true">
                    <Icon strokeWidth={2.2} />
                  </span>
                  <span className="public-proof-rule" aria-hidden="true" />
                  <h2>{item.title}</h2>
                  <p>{item.line}</p>
                </div>
              </article>
            );
          })}
        </div>
      </PublicReveal>
    </section>
  );
}
