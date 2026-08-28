// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("public SMS consent and legal-page contracts", () => {
  it("keeps SMS consent optional, unchecked by default, and explicitly versioned", () => {
    const contact = read("src/components/public/QuoteRequestForm.tsx");
    expect(contact).toContain("smsConsent: false");
    expect(contact).toContain("checked={form.smsConsent}");
    expect(contact).toContain("smsConsent: checked === true");
    expect(contact).toContain("Optional. Leave unchecked to submit without SMS consent.");
    expect(contact).toContain('smsDisclosureVersion: SMS_DISCLOSURE_VERSION');
    expect(contact).not.toMatch(/id="contact-sms-consent"[^>]*required/s);
  });

  it("records consent server-side and never interprets a missing value as opt-in", () => {
    const handler = read("supabase/functions/send-contact-email/index.ts");
    expect(handler).toContain("const smsConsent = requestedSmsConsent === true");
    expect(handler).toContain(".from('contact_submissions').insert");
    expect(handler).toContain("consent_source: SMS_CONSENT_SOURCE");
    expect(handler).toContain("consent_disclosure_version: SMS_CONSENT_VERSION");
    expect(handler).not.toMatch(/functions\.invoke\([^)]*sms/i);
  });

  it("keeps consent history private and immutable through normal client roles", () => {
    const migration = read("supabase/migrations/20260827090000_public_sms_consent.sql");
    expect(migration).toContain("sms_consent boolean not null default false");
    expect(migration).toContain("revoke all on table public.contact_submissions from public, anon");
    expect(migration).toContain("using (public.is_admin_or_staff())");
    expect(migration).not.toMatch(/grant\s+(insert|update|delete).*authenticated/i);
    expect(migration).not.toMatch(/for\s+(insert|update|delete)\s+to\s+authenticated/i);
  });

  it("publishes the legal routes and exposes them from the contact form and footer", () => {
    const app = read("src/App.tsx");
    const contact = read("src/components/public/QuoteRequestForm.tsx");
    const footer = read("src/components/Footer.tsx");
    expect(app).toContain('path="/privacy-policy"');
    expect(app).toContain('path="/terms"');
    for (const path of ["/privacy-policy", "/terms"]) {
      expect(contact).toContain(`to="${path}"`);
      expect(footer).toContain(`to="${path}"`);
    }
    expect(footer).toContain('to="/contact"');
  });

  it("includes the required mobile-information restriction and customer-care terms", () => {
    const privacy = read("src/pages/PrivacyPolicy.tsx");
    const terms = read("src/pages/Terms.tsx");
    expect(privacy).toContain("does not share, sell, rent, or provide mobile phone numbers, SMS opt-in data, or messaging consent to third parties or affiliates for marketing or promotional purposes");
    expect(terms).toContain("Program: Monkey Trucking LLC Customer Care Messaging");
    for (const page of [privacy, terms]) {
      expect(page).toContain("Message frequency varies");
      expect(page).toContain("Message and data rates may apply");
      expect(page).toContain("STOP");
      expect(page).toContain("HELP");
      expect(page).toContain("not a condition of purchase");
    }
  });
});
