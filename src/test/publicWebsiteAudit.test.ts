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
    expect(handler).toContain("Location: ${location || 'Not provided'}");
    expect(handler).toContain("location ? `Location: ${location}`");
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
