import { describe, expect, it } from "vitest";
import { computeTotals, lineTotalFor, type LineItemDraft } from "@/lib/admin/calc";
import { crushedConcrete, flexbase, nativeGravel, pricingSettings } from "@/test/fixtures/ticketFixtures";

describe("Ticket pricing preservation", () => {
  it("multiplies a full-load material by its own item load count", () => {
    expect(lineTotalFor(nativeGravel, true, 60, 3)).toEqual({ rate: 980, total: 2940 });
  });

  it("keeps per-material loads separate from editable delivery loads", () => {
    const items: LineItemDraft[] = [
      {
        key: "flexbase",
        material_id: flexbase.id,
        material_name: flexbase.name,
        is_full_load: true,
        loads: "3",
        yards: "60",
        rate_used: 720,
        line_total: 2160,
      },
      {
        key: "concrete",
        material_id: crushedConcrete.id,
        material_name: crushedConcrete.name,
        is_full_load: true,
        loads: "2",
        yards: "40",
        rate_used: 350,
        line_total: 700,
      },
    ];

    const commonCase = computeTotals({
      items,
      deliveryType: "tier_3",
      miles: 8,
      customFee: 0,
      loads: 5,
      settings: pricingSettings,
    });
    expect(commonCase).toMatchObject({
      materials_subtotal: 2860,
      delivery_total: 500,
      tax_amount: 277.2,
      grand_total: 3637.2,
      loads: 5,
    });

    const correctedDeliveryCount = computeTotals({
      items,
      deliveryType: "tier_3",
      miles: 8,
      customFee: 0,
      loads: 4,
      settings: pricingSettings,
    });
    expect(correctedDeliveryCount.loads).toBe(4);
    expect(correctedDeliveryCount.delivery_total).toBe(400);
    expect(items.reduce((sum, item) => sum + Number(item.loads), 0)).toBe(5);
  });

  it("does not silently charge delivery before a delivery option is selected", () => {
    const totals = computeTotals({
      items: [],
      deliveryType: null,
      miles: 0,
      customFee: 0,
      loads: 1,
      settings: pricingSettings,
    });
    expect(totals.delivery_total).toBe(0);
  });
});
