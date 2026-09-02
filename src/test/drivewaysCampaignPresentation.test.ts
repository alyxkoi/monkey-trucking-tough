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
    const reveal = read("components/public/PublicReveal.tsx");

    expect(page).toContain('submissionOrigin="driveway_landing"');
    expect(page).toContain("150+");
    expect(page).toContain("Years in business");
    expect(page).toContain("5-star Google rating");
    expect(page).toContain("ShieldCheck");
    expect(page).toContain("CalendarDays");
    expect(page).toContain("Star");
    expect(page).toContain("<PublicReveal blur>");
    expect(reveal).toContain('filter: "blur(8px)"');
  });
});
