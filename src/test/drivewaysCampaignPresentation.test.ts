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

  it("uses the rounded, image-overlay treatment and the comparison component", () => {
    const page = read("pages/Driveways.tsx");
    const css = read("styles/driveways.css");

    expect(page).toContain("<BeforeAfterSlider />");
    expect(css).toContain("--driveway-radius-lg: 20px");
    expect(css).toContain(".driveway-native-result::after");
    expect(css).toContain(".driveway-comparison-range");
    expect(css).toContain("clip-path: none");
  });
});
