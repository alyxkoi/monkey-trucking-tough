/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import gravelDrivewayImg from "@/assets/projects/gravel-driveway.webp";
import aggregateHaulingImg from "@/assets/services/aggregate-hauling.webp";
import crushedConcreteImg from "@/assets/projects/crushed-concrete-delivery.webp";
import drivewayRegradingImg from "@/assets/projects/driveway-regrading.webp";

export interface BlogPost {
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  excerpt: string;
  datePublished: string;
  dateDisplay: string;
  cover: string;
  coverAlt: string;
  body: () => ReactNode;
}

const InlineFigure = ({ src, alt, caption }: { src: string; alt: string; caption?: string }) => (
  <figure className="my-10">
    <div className="relative aspect-[16/10] overflow-hidden rounded-lg hairline">
      <img src={src} alt={alt} loading="lazy" decoding="async" width="1600" height="1000" className="absolute inset-0 h-full w-full object-cover" />
    </div>
    {caption && <figcaption className="mt-3 text-sm text-white/55">{caption}</figcaption>}
  </figure>
);

const H2 = ({ children }: { children: ReactNode }) => <h2 className="mb-5 mt-12 font-heading text-3xl uppercase tracking-wide text-white sm:text-4xl">{children}</h2>;
const P = ({ children }: { children: ReactNode }) => <p className="mb-6 text-[17px] leading-[1.75] text-white/80 sm:text-[18px]">{children}</p>;

export const POSTS: BlogPost[] = [
  {
    slug: "meet-monkey-trucking",
    title: "Meet Monkey Trucking in Kaufman, Texas",
    seoTitle: "Meet Monkey Trucking | Materials and Dirt Work in Kaufman TX",
    description: "Learn what Monkey Trucking offers in Kaufman, Texas, including material delivery, driveway work, ponds, grading, hauling and light land clearing.",
    excerpt: "A direct look at the material, hauling and property work available through Monkey Trucking.",
    datePublished: "2026-05-31",
    dateDisplay: "May 31, 2026",
    cover: gravelDrivewayImg,
    coverAlt: "Completed gravel driveway near Kaufman, Texas",
    body: () => (
      <>
        <P>Monkey Trucking is based in Kaufman, Texas and works with homeowners, property owners, ranch owners and contractors across Kaufman County and surrounding DFW areas.</P>
        <H2>Materials and delivery</H2>
        <P>Available materials include crushed concrete, flexbase, sand, asphalt millings, native gravel, decomposed granite and limestone. Visit the <Link to="/materials" className="text-primary underline underline-offset-4">Materials page</Link> for the current catalog.</P>
        <InlineFigure src={aggregateHaulingImg} alt="Dump truck delivering aggregate material" caption="Aggregate delivery for homes, ranches and job sites." />
        <H2>Property work</H2>
        <P>Services include driveways and private roads, pond work, grading, site preparation, aggregate hauling and light land clearing for brush, small trees, rocks and related site work.</P>
        <P>Call 214-677-8466 or send a quote request with the location and work you have in mind.</P>
      </>
    ),
  },
  {
    slug: "why-we-built-our-own-material-plant",
    title: "Choosing Material for a Driveway",
    seoTitle: "Choosing Driveway Material Near Kaufman TX | Monkey Trucking",
    description: "Compare common driveway material options such as crushed concrete, flexbase, asphalt millings and native gravel before requesting delivery or driveway work.",
    excerpt: "The right driveway material depends on the site, drainage, traffic and finish you want.",
    datePublished: "2026-05-31",
    dateDisplay: "May 31, 2026",
    cover: crushedConcreteImg,
    coverAlt: "Crushed concrete being delivered for a driveway project",
    body: () => (
      <>
        <P>Crushed concrete, flexbase, asphalt millings and native gravel can all work for driveways. The best choice depends on the existing ground, drainage, traffic and finish you want.</P>
        <H2>Start with the site</H2>
        <P>A durable driveway needs appropriate grading and a stable base. Low areas, runoff and soft ground should be considered before material is placed.</P>
        <InlineFigure src={drivewayRegradingImg} alt="Driveway surface being prepared for fresh material" caption="Grading and base preparation affect how a driveway holds up." />
        <H2>Ask about current options</H2>
        <P>Material availability and delivery needs vary by job. Review the <Link to="/materials" className="text-primary underline underline-offset-4">current material catalog</Link>, then call or request a quote for the site and amount you need.</P>
      </>
    ),
  },
];
