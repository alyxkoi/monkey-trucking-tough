// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("driveway campaign presentation", () => {
  it("keeps the campaign route outside the shared browsing layout", () => {
    const app = read("App.tsx");
    const layout = read("components/Layout.tsx");
    const page = read("pages/Driveways.tsx");
    const sharedLayoutClose = app.indexOf("</Route>", app.indexOf('<Route element={<Layout />}'));
    const drivewayRoute = app.indexOf('<Route path="/driveways"');

    expect(drivewayRoute).toBeGreaterThan(sharedLayoutClose);
    expect(layout).not.toContain('"/driveways"');
    expect(page).not.toContain("<Header");
    expect(page).not.toContain("MobileCallBar");
    expect(page).toContain("<Footer />");
  });

  it("uses the verified comparison once in the centered hero", () => {
    const page = read("pages/Driveways.tsx");
    const comparison = read("components/driveways/BeforeAfterSlider.tsx");
    const css = read("styles/driveways.css");

    expect(page.match(/<BeforeAfterSlider/g)).toHaveLength(1);
    expect(page).toContain('driveway-before.webp');
    expect(page).toContain('driveway-after.webp');
    expect(page).not.toContain("driveway-native-featured");
    expect(comparison).not.toContain("Matched project photos needed");
    expect(comparison).not.toContain("driveway-comparison-placeholder");
    expect(css).toContain("--driveway-radius-lg: 20px");
    expect(css).toContain(".driveway-native-result::after");
    expect(css).toContain(".driveway-comparison-range");
    expect(css).toContain("clip-path: none");
  });

  it("keeps the form source context and adds the compact trust rail", () => {
    const page = read("pages/Driveways.tsx");
    const motion = read("components/driveways/DrivewayMotion.tsx");
    const reveal = read("components/public/PublicReveal.tsx");
    const css = read("styles/driveways.css");

    expect(page).toContain('submissionOrigin="driveway_landing"');
    expect(page).toContain("<DrivewayTrustStats />");
    expect(motion).toContain("useCountUp(150, 0, 1500");
    expect(motion).toContain("useCountUp(12, 1, 1200");
    expect(motion).toContain("staggerChildren: 0.11");
    expect(motion.match(/driveway-form-trust-separator/g)).toHaveLength(2);
    expect(css).not.toContain(".driveway-form-trust-item + .driveway-form-trust-item");
    expect(css).toContain("rgba(232, 235, 238, 0.7)");
    expect(reveal).toContain('filter: `blur(${blurAmount}px)`');
  });

  it("uses one-shot typing, restrained storm timing and cinematic reveal durations", () => {
    const page = read("pages/Driveways.tsx");
    const motion = read("components/driveways/DrivewayMotion.tsx");

    expect(page).toContain("<DrivewayHeroHeadline />");
    expect(page).toContain("<DrivewayResultsHeadline />");
    expect(motion).toContain("useTypedCharacters(combined, true, 1300");
    expect(motion).toContain("useTypedCharacters(heading, inView, 950");
    expect(motion).toContain("10_000");
    expect(motion).toContain('document.addEventListener("visibilitychange"');
    expect(page).toContain('duration={1.5} scale={1.015}');
    expect(page).toContain('className="driveway-native-form" delay={0.16} blur');
    expect(page).toContain('duration={1.25} scale={1.012}');
  });

  it("places the seamless sample review marquee between project results and the larger trust cards", () => {
    const page = read("pages/Driveways.tsx");
    const reviews = read("components/driveways/DrivewayReviewMarquee.tsx");
    const css = read("styles/driveways.css");
    const resultsEnd = page.indexOf("</section>", page.indexOf('className="driveway-native-results"'));
    const reviewsPosition = page.indexOf("<DrivewayReviewMarquee />");
    const trustPosition = page.indexOf("<TrustRail items={trustItems} />");

    expect(reviewsPosition).toBeGreaterThan(resultsEnd);
    expect(reviewsPosition).toBeLessThan(trustPosition);
    expect(reviews).toContain('name: "Maria G."');
    expect(reviews).toContain('name: "Thomas B."');
    expect(reviews.match(/name: "/g)).toHaveLength(6);
    expect(reviews).not.toMatch(/detail: ".*[—-].*"/);
    expect(reviews).not.toContain("Sample customer review");
    expect(reviews).toContain("Illustrative reviews");
    expect(reviews).not.toContain("avatar");
    expect(css).toContain("font-family: Anton, Impact, sans-serif");
    expect(css).toContain("animation: driveway-review-marquee 92s linear infinite");
    expect(css).not.toContain("animation-play-state: paused");
    expect(css).toContain("backdrop-filter: blur(20px) saturate(126%)");
    expect(css).not.toContain("backdrop-filter: blur(9px)");
    expect(css).toContain("linear-gradient(90deg, rgba(11, 11, 13, 0.96), rgba(11, 11, 13, 0))");
    expect(css).toContain(".driveway-page .public-proof-section {\n  background: #000;\n}");
    expect(css).toContain('.driveway-review-marquee-set[aria-hidden="true"] { display: none; }');
  });
});
