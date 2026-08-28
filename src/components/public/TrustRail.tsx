import PublicReveal from "./PublicReveal";

const proof = [
  { title: "Kaufman, Texas", line: "Local service across Kaufman County and surrounding DFW areas." },
  { title: "Materials + Delivery", line: "Aggregate supply, hauling and delivery for your property or job site." },
  { title: "Upfront Quotes", line: "Send the work and location, then confirm the scope before scheduling." },
];

export default function TrustRail() {
  return (
    <section className="bg-[#19191c] text-white" aria-label="Monkey Trucking service facts">
      <PublicReveal className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 border-x border-white/10 sm:grid-cols-3">
          {proof.map((item, index) => (
            <div key={item.title} className={`group relative isolate overflow-hidden px-5 py-8 sm:min-h-[190px] sm:px-6 sm:py-10 lg:px-9 ${index > 0 ? "border-t border-white/10 sm:border-l sm:border-t-0" : ""}`}>
              <span className="absolute inset-x-0 bottom-0 -z-10 h-full origin-bottom scale-y-0 bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none group-hover:scale-y-100" aria-hidden="true" />
              <h2 className="font-heading text-[clamp(28px,3vw,40px)] uppercase leading-none text-primary transition-colors duration-200 group-hover:text-white">{item.title}</h2>
              <p className="mt-3 max-w-sm text-base leading-relaxed text-white/[0.68] transition-colors duration-200 group-hover:text-white/90">{item.line}</p>
            </div>
          ))}
        </div>
      </PublicReveal>
    </section>
  );
}
