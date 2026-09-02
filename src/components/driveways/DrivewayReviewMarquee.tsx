import { Star } from "lucide-react";
import PublicReveal from "@/components/public/PublicReveal";

const reviewSignals = [
  { eyebrow: "Google rating", value: "5 stars", detail: "Public customer rating" },
  { eyebrow: "Customer feedback", value: "Five stars", detail: "Rated five stars on Google" },
  { eyebrow: "Local reputation", value: "5.0 / 5", detail: "Google customer rating" },
] as const;

function ReviewCards({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div className="driveway-review-marquee-set" aria-hidden={duplicate || undefined}>
      {reviewSignals.map((signal) => (
        <article className="driveway-review-card" key={signal.eyebrow}>
          <div className="driveway-review-card-topline">
            <span className="driveway-review-brand" aria-hidden="true">MT</span>
            <span>{signal.eyebrow}</span>
          </div>
          <strong className="font-heading">{signal.value}</strong>
          <div className="driveway-review-stars" aria-label="5 stars">
            {Array.from({ length: 5 }, (_, index) => <Star key={index} fill="currentColor" aria-hidden="true" />)}
          </div>
          <p>{signal.detail}</p>
        </article>
      ))}
    </div>
  );
}

export default function DrivewayReviewMarquee() {
  return (
    <section className="driveway-reviews" aria-labelledby="driveway-reviews-title">
      <div className="driveway-native-shell">
        <PublicReveal className="driveway-reviews-heading" blur>
          <p>Customer rating</p>
          <h2 id="driveway-reviews-title" className="font-display">Trusted by our customers.</h2>
        </PublicReveal>
      </div>
      <PublicReveal className="driveway-review-marquee" blur delay={0.08}>
        <div className="driveway-review-marquee-track">
          <ReviewCards />
          <ReviewCards duplicate />
        </div>
      </PublicReveal>
    </section>
  );
}
