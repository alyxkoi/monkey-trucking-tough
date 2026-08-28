import { ArrowRight } from "lucide-react";

interface MaterialCardProps {
  name: string;
  use: string;
  image: string;
}

const MaterialCard = ({ name, use, image }: MaterialCardProps) => (
  <article className="public-material-catalog-card">
    <div className="public-material-catalog-media">
      <img
        src={image}
        alt={`${name} aggregate sample`}
        loading="lazy"
        decoding="async"
      />
    </div>
    <div className="public-material-catalog-copy">
      <div className="public-material-catalog-accent" aria-hidden="true" />
      <h2>{name}</h2>
      <p>{use}</p>
      <a href="tel:+12146778466">
        <span>Call for current pricing</span>
        <ArrowRight aria-hidden="true" />
      </a>
    </div>
  </article>
);

export default MaterialCard;
