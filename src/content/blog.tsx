import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import gravelDrivewayImg from "@/assets/projects/gravel-driveway.webp";
import dirtWorkImg from "@/assets/services/dirt-work.webp";
import landClearingImg from "@/assets/projects/land-clearing.webp";
import aggregateHaulingImg from "@/assets/services/aggregate-hauling.webp";
import crushedConcreteImg from "@/assets/projects/crushed-concrete-delivery.webp";
import drivewayRegradingImg from "@/assets/projects/driveway-regrading.webp";

export interface BlogPost {
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  excerpt: string;
  datePublished: string; // ISO date
  dateDisplay: string;
  cover: string;
  coverAlt: string;
  body: () => ReactNode;
}

const PullQuote = ({ children, cite }: { children: ReactNode; cite?: string }) => (
  <figure className="my-10 pl-6 border-l-4 border-primary">
    <blockquote className="font-heading uppercase text-white text-2xl sm:text-3xl leading-tight tracking-wide">
      {children}
    </blockquote>
    {cite && (
      <figcaption className="mt-3 text-sm tracking-[0.18em] uppercase text-white/55">
        {cite}
      </figcaption>
    )}
  </figure>
);

const InlineFigure = ({ src, alt, caption }: { src: string; alt: string; caption?: string }) => (
  <figure className="my-10">
    <div className="relative aspect-[16/10] overflow-hidden rounded-lg hairline">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        width="1600"
        height="1000"
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
    {caption && (
      <figcaption className="mt-3 text-sm text-white/55 italic">{caption}</figcaption>
    )}
  </figure>
);

const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="font-heading uppercase text-white text-3xl sm:text-4xl tracking-wide mt-14 mb-5">
    {children}
  </h2>
);

const P = ({ children }: { children: ReactNode }) => (
  <p className="text-white/80 text-[17px] sm:text-[18px] leading-[1.75] mb-6">{children}</p>
);

export const POSTS: BlogPost[] = [
  {
    slug: "meet-monkey-trucking",
    title: "Meet Monkey Trucking: The Family Owned Kaufman Crew Hauling Gravel Across DFW",
    seoTitle: "Meet Monkey Trucking: Family-Owned Gravel Hauling in Kaufman & DFW",
    description:
      "Since 2010, Monkey Trucking has hauled gravel and built driveways across Kaufman County and all of DFW. Meet the family-owned crew behind the trucks.",
    excerpt:
      "Since 2010, the family-owned Kaufman crew has been hauling aggregate and building driveways across North Texas.",
    datePublished: "2026-05-31",
    dateDisplay: "May 31, 2026",
    cover: gravelDrivewayImg,
    coverAlt: "Freshly built gravel driveway in Kaufman County, Texas",
    body: () => (
      <>
        <P>
          If you have ever pulled into a fresh gravel driveway or watched a new stock pond fill
          up somewhere around Kaufman County, there is a fair chance Monkey Trucking had a hand
          in it. The company has been hauling aggregate, moving dirt, and building driveways
          across North Texas since 2010, and it still runs the same way it started. As a family
          business that answers the phone and shows up when it says it will.
        </P>
        <P>
          It began with one man and a love for the work. [Your dad&apos;s name] founded Monkey
          Trucking in 2010, and not because he found a gap in some business plan. He started it
          because he genuinely loved trucking. He had spent years around the transportation and
          construction trades and knew how material moves from the plant to the job site, and
          that was the part he could never put down.
        </P>

        <PullQuote cite={"[Your dad's name], Founder"}>
          I started this company because I love trucking, plain and simple. I knew the
          transportation side and I knew construction, and I figured folks around here deserved
          somebody local they could actually count on.
        </PullQuote>

        <P>
          More than twelve years later, that local promise is still the whole point. Monkey
          Trucking has completed over 150 jobs for homeowners, ranchers, and builders, and
          being family owned is the reason it can move fast. There is no call center and no
          runaround. When you call, you get the people who do the work, you get honest pricing
          up front, and you do not get brushed off.
        </P>

        <InlineFigure
          src={landClearingImg}
          alt="Monkey Trucking crew clearing land on a North Texas job site"
          caption="From Kaufman across the metroplex: same crew, same trucks, every job."
        />

        <P>
          Home base is Kaufman, but the trucks run all over the Dallas Fort Worth metroplex.
          The crew regularly delivers and works in Forney, Terrell, Crandall, Kemp, Mabank,
          Scurry, Sachse, Royse City, Canton, Wills Point, Seagoville, Mesquite, Dallas, Oak
          Cliff, Rockwall, and pretty much anywhere across DFW that needs material moved.
        </P>
        <P>
          And they handle the full range of it. Gravel delivery,{" "}
          <Link to="/materials" className="text-primary underline underline-offset-4 hover:text-primary/80">
            crushed concrete
          </Link>
          , flex base, mason sand, decomposed granite, and top soil straight off the truck. New
          gravel driveways and private roads built to last. Pond construction for livestock and
          irrigation. Dirt work, grading, and land clearing. If it involves hauling aggregate
          or shaping a piece of ground, it is in their wheelhouse.
        </P>

        <PullQuote cite="[Add one real customer quote here]">
          Text a past customer for a sentence about their job. Include their first name, last
          initial, town, and job type.
        </PullQuote>

        <P>
          That mix of local roots and real equipment is what keeps the phone ringing. Twelve
          years in, Monkey Trucking is still the crew Kaufman County calls first.
        </P>
      </>
    ),
  },
  {
    slug: "why-we-built-our-own-material-plant",
    title: "Why We Built Our Own Material Plant, and How It Saves You Money",
    seoTitle: "Why We Run Our Own Material Plant | Cheaper Crushed Concrete in DFW",
    description:
      "Monkey Trucking produces its own recycled crushed concrete and aggregate, so customers across DFW skip the middleman and get lower prices and faster delivery.",
    excerpt:
      "Owning the plant cuts out the middleman. The result: lower prices, faster trucks, and same-week delivery across DFW.",
    datePublished: "2026-05-31",
    dateDisplay: "May 31, 2026",
    cover: aggregateHaulingImg,
    coverAlt: "Loaded Monkey Trucking dump truck leaving the material plant",
    body: () => (
      <>
        <P>
          Most people never think about where their gravel comes from. They just know it costs
          more than it used to. Here is a little secret from inside the trade: a lot of that
          price is markup that gets stacked on every time the material changes hands. Monkey
          Trucking cut that out years ago by running its own material plant.
        </P>
        <P>
          That single decision is the difference between buying from a middleman and buying
          from the source. Because Monkey Trucking produces its own recycled crushed concrete
          and asphalt millings, there is no extra layer of cost passed down to the customer.
          You pay for the material and the haul, and that is it.
        </P>

        <PullQuote cite={"[Your dad's name], Founder"}>
          When you own the plant, you control the price and you control the truck. We are not
          waiting on somebody else to load us up. That is how we keep it cheap and how we get
          it there fast.
        </PullQuote>

        <P>
          The savings are real, but so is the quality. Recycled{" "}
          <Link to="/materials" className="text-primary underline underline-offset-4 hover:text-primary/80">
            crushed concrete
          </Link>{" "}
          is one of the most affordable and durable options for driveways, parking pads, and
          base layers, and it keeps usable material out of the landfill at the same time. Along
          with crushed concrete and millings, the plant supplies flex base, mason sand,
          decomposed granite, native gravels, and top soil for just about any job.
        </P>

        <InlineFigure
          src={crushedConcreteImg}
          alt="Fresh load of recycled crushed concrete delivered by Monkey Trucking"
          caption="Recycled crushed concrete straight off our truck, no middleman markup."
        />

        <P>
          Owning the supply also means owning the schedule. When a customer in Terrell or
          Royse City needs a load this week, the crew is not stuck behind another company&apos;s
          backlog. They load up and roll out, which is why same week delivery is normal rather
          than a special favor.
        </P>

        <div className="my-10 grid grid-cols-2 gap-3">
          <figure className="relative aspect-[4/3] overflow-hidden rounded-lg hairline">
            <img
              src={drivewayRegradingImg}
              alt="Rutted, washed-out driveway before Monkey Trucking regraded it"
              loading="lazy"
              decoding="async"
              width="1200"
              height="900"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <figcaption className="absolute top-3 left-3 bg-nearblack/80 text-white text-xs tracking-[0.2em] uppercase px-2 py-1 rounded">
              Before
            </figcaption>
          </figure>
          <figure className="relative aspect-[4/3] overflow-hidden rounded-lg hairline">
            <img
              src={gravelDrivewayImg}
              alt="Same driveway rebuilt with a proper base and fresh crushed concrete"
              loading="lazy"
              decoding="async"
              width="1200"
              height="900"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <figcaption className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs tracking-[0.2em] uppercase px-2 py-1 rounded">
              After
            </figcaption>
          </figure>
        </div>

        <P>
          You can see the difference on a finished job. On a recent driveway, the crew started
          with a rutted, washed out mess and rebuilt it with a proper base and a fresh layer of
          crushed concrete and gravel. Same ground, completely different result, and a price
          that beat the big suppliers.
        </P>

        <PullQuote cite="[Add one real customer quote here]">
          A sentence like &ldquo;The crushed concrete from Monkey Trucking held up through the
          rain when my old gravel washed away every spring.&rdquo; First name, last initial,
          town, job type.
        </PullQuote>

        <P>
          The takeaway is simple. When a company owns its own plant, the customer wins on both
          price and speed. That is the entire reason Monkey Trucking built one.
        </P>
      </>
    ),
  },
];

// Avoid unused import warning when dirt-work asset isn't directly referenced above.
void dirtWorkImg;
