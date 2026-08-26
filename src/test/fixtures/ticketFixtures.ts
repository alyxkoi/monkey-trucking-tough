import type { Material, Settings } from "@/lib/admin/calc";
import type { TicketDraft } from "@/lib/admin/tickets";

export const pricingSettings: Settings = {
  id: 1,
  company_name: "Monkey Trucking",
  company_address: "",
  company_city_state_zip: "",
  company_phone: "",
  delivery_tier_1_max_miles: 2,
  delivery_tier_1_fee: 0,
  delivery_tier_2_max_miles: 5,
  delivery_tier_2_fee: 60,
  delivery_tier_3_max_miles: 10,
  delivery_tier_3_fee: 100,
  delivery_overage_base_fee: 100,
  delivery_overage_per_mile: 10,
  next_ticket_number: 1001,
  print_copies: 1,
  print_method: "share",
  tax_applies_to_delivery: true,
  tax_rate: 8.25,
  ticket_prefix: "MT",
  updated_at: "2026-08-26T00:00:00.000Z",
};

const material = (
  id: string,
  name: string,
  fullLoadPrice: number,
  fullLoadYards = 20,
  pricePerYard = fullLoadPrice / fullLoadYards,
): Material => ({
  id,
  name,
  full_load_price: fullLoadPrice,
  full_load_yards: fullLoadYards,
  price_per_yard: pricePerYard,
  is_active: true,
  sort_order: 1,
  created_at: "2026-08-26T00:00:00.000Z",
  updated_at: "2026-08-26T00:00:00.000Z",
});

export const flexbase = material("00000000-0000-4000-8000-000000000001", "Flexbase", 720);
export const crushedConcrete = material("00000000-0000-4000-8000-000000000002", "Crushed Concrete", 350);
export const nativeGravel = material("00000000-0000-4000-8000-000000000003", "Native Gravel", 980);

export const safeTicketDraft: TicketDraft = {
  customer_name: "Regression Customer",
  customer_phone: "",
  job_site_address: "Regression Site",
  driver_id: null,
  delivery_type: "tier_3",
  delivery_miles: null,
  delivery_fee_per_load: 100,
  load_count: 5,
  delivery_total: 500,
  materials_subtotal: 2860,
  tax_rate: 8.25,
  tax_applies_to_delivery: true,
  tax_amount: 277.2,
  grand_total: 3637.2,
  notes: null,
  items: [
    {
      material_id: flexbase.id,
      material_name: flexbase.name,
      yards: 60,
      is_full_load: true,
      rate_used: 720,
      line_total: 2160,
      loads: 3,
    },
    {
      material_id: crushedConcrete.id,
      material_name: crushedConcrete.name,
      yards: 40,
      is_full_load: true,
      rate_used: 350,
      line_total: 700,
      loads: 2,
    },
  ],
};

// Represents an entry already stored under mt_ticket_queue_v1. Unknown values
// are deliberately absent so the compatibility path must preserve them as null.
export const legacyQueueEntry = {
  id: "00000000-0000-4000-8000-000000001101",
  queued_at: "2026-08-25T12:00:00.000Z",
  draft: {
    customer_name: "Legacy Regression Customer",
    customer_phone: "",
    job_site_address: "Legacy Regression Site",
    driver_id: null,
    delivery_type: "tier_2",
    delivery_miles: null,
    delivery_fee_per_load: 60,
    load_count: 1,
    delivery_total: 60,
    materials_subtotal: 350,
    tax_rate: 8.25,
    tax_amount: 33.83,
    grand_total: 443.83,
    notes: null,
    items: [
      {
        material_id: crushedConcrete.id,
        material_name: crushedConcrete.name,
        yards: 20,
        is_full_load: true,
        rate_used: 350,
        line_total: 350,
      },
    ],
  },
};
