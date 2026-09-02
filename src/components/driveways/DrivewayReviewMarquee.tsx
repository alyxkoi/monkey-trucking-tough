import { Star } from "lucide-react";
import PublicReveal from "@/components/public/PublicReveal";

const reviewDrafts = [
  {
    name: "Maria G.",
    initials: "MG",
    detail: "They fixed the washout at the bottom of our driveway and got the grade right. The next hard rain came through with no standing water.",
  },
  {
    name: "James R.",
    initials: "JR",
    detail: "They showed up when they said they would and explained what the driveway needed before starting. It looks clean and drives smooth now.",
  },
  {
    name: "Denise M.",
    initials: "DM",
    detail: "Our driveway had deep ruts and held water every time it rained. They reshaped it and the difference was immediate.",
  },
  {
    name: "Carlos T.",
    initials: "CT",
    detail: "The crew was easy to work with and left everything neat when they finished. We are very happy with how the gravel turned out.",
  },
  {
    name: "Rachel P.",
    initials: "RP",
    detail: "I appreciated the clear communication from the estimate through the finished job. The price matched what we discussed.",
  },
  {
    name: "Thomas B.",
    initials: "TB",
    detail: "They added gravel and corrected a low spot near the road. It has handled several storms without washing out again.",
  },
] as const;

function ReviewCards({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div className="driveway-review-marquee-set" aria-hidden={duplicate || undefined}>
      {reviewDrafts.map((review) => (
        <article className="driveway-review-card" key={review.name}>
          <div className="driveway-review-card-topline">
            <span className="driveway-review-brand" aria-hidden="true">{review.initials}</span>
            <div className="driveway-review-person">
              <strong>{review.name}</strong>
              <span>Sample customer review</span>
            </div>
            <div className="driveway-review-stars" aria-label="5 out of 5 stars">
              {Array.from({ length: 5 }, (_, index) => <Star key={index} fill="currentColor" aria-hidden="true" />)}
            </div>
          </div>
          <p>“{review.detail}”</p>
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
