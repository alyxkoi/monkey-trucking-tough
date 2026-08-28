interface MaterialCardProps {
  name: string;
  use: string;
  image: string;
}

const MaterialCard = ({ name, use, image }: MaterialCardProps) => (
  <article className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
    <div className="aspect-[5/4] bg-[#ebe9e5] p-3 sm:p-4">
      <img
        src={image}
        alt={`${name} aggregate sample`}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
      />
    </div>
    <div className="border-t border-black/10 p-4 sm:p-5">
      <h2 className="font-heading text-[22px] uppercase leading-[0.98] text-foreground sm:text-[26px]">{name}</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">{use}</p>
      <p className="mt-4 font-label text-sm font-bold text-primary">Call for current pricing</p>
    </div>
  </article>
);

export default MaterialCard;
