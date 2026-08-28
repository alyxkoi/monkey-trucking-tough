// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const publicSources = [
  "src/pages/Index.tsx",
  "src/pages/Services.tsx",
  "src/pages/Materials.tsx",
  "src/pages/Projects.tsx",
  "src/pages/Contact.tsx",
  "src/pages/Blog.tsx",
  "src/pages/BlogPost.tsx",
  "src/components/Header.tsx",
  "src/components/auth/UserMenu.tsx",
  "src/components/Footer.tsx",
  "src/components/CTASection.tsx",
  "src/components/home/MobileCallBar.tsx",
  "src/components/public/HomeHero.tsx",
  "src/components/public/PublicContactSection.tsx",
  "src/components/public/QuoteRequestForm.tsx",
  "src/components/public/ServiceFeatureGrid.tsx",
  "src/components/public/PopularMaterialsSection.tsx",
  "src/components/public/RecentWorkSection.tsx",
  "src/components/public/TrustRail.tsx",
  "src/content/publicHome.ts",
  "src/content/blog.tsx",
].map(read).join("\n");

describe("public website contracts", () => {
  it("uses only the approved direct-call URI and exposes no public SMS action", () => {
    expect(publicSources).not.toMatch(/href=[{`"]*sms:/i);
    expect(publicSources).not.toMatch(/call\s*(\/|or)\s*text|text us|text the crew/i);
    const telephoneLinks = [...publicSources.matchAll(/(?:href=|href\s*=\s*)["'](tel:[^"']+)["']/g)].map((match) => match[1]);
    expect(telephoneLinks.length).toBeGreaterThan(0);
    expect(new Set(telephoneLinks)).toEqual(new Set(["tel:+12146778466"]));
  });

  it("keeps the architectural Home sequence in the approved order", () => {
    const home = read("src/pages/Index.tsx");
    const services = read("src/components/public/ServiceFeatureGrid.tsx");
    const css = read("src/index.css");
    const sequence = [
      "<HomeHero",
      "<ServiceFeatureGrid",
      "<PopularMaterialsSection",
      "<RecentWorkSection",
      "<TrustRail",
      "<PublicContactSection",
    ];
    let cursor = -1;
    for (const label of sequence) {
      const next = home.indexOf(label);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(home).not.toMatch(/CTASection|marquee|testimonial|How it works|Years in Business|Jobs Completed/i);
    expect(services).toContain("Here&apos;s What We Do.");
    expect(services).toContain("public-service-feature-section");
    expect(css).toMatch(/\.public-service-feature-section\s*{[^}]*#e9eaeb[^}]*#dcdee0[^}]*#bec1c5/s);
  });

  it("keeps the public header centered and the Hero media contract exact", () => {
    const header = read("src/components/Header.tsx");
    const userMenu = read("src/components/auth/UserMenu.tsx");
    const hero = read("src/components/public/HomeHero.tsx");
    const css = read("src/index.css");
    const html = read("index.html");

    expect(header).toContain("public-header-grid");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)");
    expect(header).toContain('to="/contact"');
    expect(header).toContain('const PHONE_HREF = "tel:+12146778466"');
    expect(userMenu).toContain("LayoutDashboard");
    expect(userMenu).toContain("Dashboard");
    expect(userMenu).not.toContain("Tickets");
    expect(hero).toContain("https://dugmcjpistrxxryaubkd.supabase.co/storage/v1/object/public/videos//job1 cropped 3x2.mp4");
    expect(hero).toContain('const DESKTOP_QUERY = "(min-width: 1200px)"');
    expect(hero).toContain("const videoSrc = isDesktop ? DESKTOP_HERO_VIDEO_URL : HERO_VIDEO_URL");
    expect(hero).toContain("https://dugmcjpistrxxryaubkd.supabase.co/storage/v1/object/public/videos//job home hero.mp4");
    expect(hero).toContain("autoPlay={!reduceMotion}");
    expect(hero).toContain("playsInline");
    expect(hero).not.toContain("<img");
    expect(hero).toContain("Material Delivery");
    expect(hero).toContain("Driveway Installation");
    expect(hero).toContain("Dirt &amp; Site Work");
    expect(hero).toContain('value: "10+"');
    expect(hero).toContain('value: "200+"');
    expect(hero).toContain('value: "5 Stars"');
    expect(hero).toContain('filter: "blur(12px)"');
    expect(hero).toContain('to="/contact"');
    expect(css).not.toContain(".public-home-hero-panel::after");
    expect(css).not.toContain("public-home-hero-poster");
    expect(css).not.toMatch(/public-home-hero-media video[^{]*{[^}]*mask-image/s);
    expect(html).toContain('href="https://dugmcjpistrxxryaubkd.supabase.co"');
  });

  it("publishes the exact approved material catalog without public prices", () => {
    const materials = read("src/pages/Materials.tsx");
    for (const name of [
      "Commercial Crushed Concrete Clean",
      "Select Fill and Cushion Sand",
      "3x4 Crushed Concrete",
      'Flexbase First Class 1" or 3"',
      "Mason Sand",
      'Millings Asphalt 1/2" Minus',
      'Native Gravel 3/8"-1"',
      "Concrete Sand Mix Native Gravel",
      "Decomposed Granite",
      'Limestone 1"-1 1/2"',
    ]) expect(materials).toContain(name);
    expect(materials).not.toMatch(/\$\d/);
  });

  it("keeps light land clearing accurately scoped", () => {
    const services = read("src/pages/Services.tsx");
    for (const scope of ["Brush", "Small trees", "Rocks and boulders", "Associated site clearing"]) expect(services).toContain(scope);
    expect(services).not.toMatch(/projects of all sizes|demolition|major forestry|large-scale specialized/i);
  });

  it("keeps contact attribution, consent, and service location in the real submission path", () => {
    const contact = read("src/components/public/QuoteRequestForm.tsx");
    const handler = read("supabase/functions/send-contact-email/index.ts");
    expect(contact).toContain("trackingAttribution: getTrackingAttribution()");
    expect(contact).toContain("smsConsent: false");
    expect(contact).toContain('`${idPrefix}-location`');
    expect(contact).toContain("Continue to project details");
    expect(contact).toContain("Step {step} of 2");
    expect(contact).toContain('role="progressbar"');
    expect(read("src/index.css")).not.toContain(".public-contact-heading::after");
    expect(handler).toContain("Location: ${location || 'Not provided'}");
    expect(handler).toContain("location ? `Location: ${location}`");
  });

  it("uses the supplied Perlin waves safely across both public contact experiences", () => {
    const section = read("src/components/public/PublicContactSection.tsx");
    const page = read("src/pages/Contact.tsx");
    const waves = read("src/components/ui/interactive-waves.tsx");

    expect(section).toContain("InteractiveWaves");
    expect(section).not.toContain("VerticalBarsNoise");
    expect(page).toContain('variant="page"');
    expect(page).not.toContain("contactHeroImg");
    expect(waves).toContain("class Noise");
    expect(waves).toContain("perlin2");
    expect(waves).toContain("ResizeObserver");
    expect(waves).toContain("IntersectionObserver");
    expect(waves).toContain("prefers-reduced-motion: reduce");
    expect(waves).toContain("cancelAnimationFrame");
    expect(waves).not.toContain("preventDefault");
    expect(waves).not.toContain('addEventListener("touchmove"');
  });

  it("uses architectural proof panels and an accurate grounded footer", () => {
    const proof = read("src/components/public/TrustRail.tsx");
    const footer = read("src/components/Footer.tsx");
    const css = read("src/index.css");

    for (const icon of ["MapPin", "Truck", "ClipboardCheck"]) expect(proof).toContain(icon);
    expect(proof).toContain("public-proof-card");
    expect(css).toContain(".public-proof-card-fill");
    expect(css).toContain("transform: scaleY(0)");
    expect(css).toContain("transition: transform 440ms");

    for (const path of ["/", "/services", "/materials", "/projects", "/contact", "/blog", "/privacy-policy", "/terms"]) {
      expect(footer).toContain(`to="${path}"`);
    }
    expect(footer).toContain('href="tel:+12146778466"');
    expect(footer.match(/214-677-8466/g)).toHaveLength(1);
    expect(footer).toContain("crushed-concrete.webp");
    expect(footer).not.toMatch(/About|Site Map|Demolition|Facebook|Instagram/);
    expect(footer).not.toContain("Call Monkey Trucking");
    expect(footer).not.toContain("pointer-events-none select-none");
  });

  it("contains no placeholder business identity or testimonial copy", () => {
    expect(publicSources).not.toMatch(/\[Your|\[Add one real|John Doe|Jane Doe|150\+ Jobs|12\+ Years/i);
    const html = read("index.html");
    expect(html).toContain('"telephone": "+1-214-677-8466"');
    expect(html).not.toContain("+1-000-000-0000");
  });

  it("uses no em dash or en dash punctuation in public customer copy", () => {
    expect(publicSources).not.toMatch(/[—–]/);
  });
});
