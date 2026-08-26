import type { Tables } from "@/integrations/supabase/types";

export type Settings = Tables<"app_settings">;
export type Material = Tables<"materials">;
export type Driver = Tables<"drivers">;

export type DeliveryType = "tier_1" | "tier_2" | "tier_3" | "over_10" | "custom" | "pickup";

export interface LineItemDraft {
  key: string;
  material_id: string;
  material_name: string;
  is_full_load: boolean;
  yards: string;
  rate_used: number;
  line_total: number;
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export const deliveryLabels = (s?: Settings | null): Record<DeliveryType, string> => ({
  tier_1: `Free zone, 0 to ${s?.delivery_tier_1_max_miles ?? 2} miles`,
  tier_2: `3 to ${s?.delivery_tier_2_max_miles ?? 5} miles, ${money(Number(s?.delivery_tier_2_fee ?? 60))}`,
  tier_3: `6 to ${s?.delivery_tier_3_max_miles ?? 10} miles, ${money(Number(s?.delivery_tier_3_fee ?? 100))}`,
  over_10: `Over ${s?.delivery_tier_3_max_miles ?? 10} miles`,
  custom: "Custom fee",
  pickup: "Customer pickup, no charge",
});

export const deliveryShort: Record<DeliveryType, string> = {
  tier_1: "0-2 mi",
  tier_2: "3-5 mi",
  tier_3: "6-10 mi",
  over_10: "Over 10 mi",
  custom: "Custom",
  pickup: "Pickup",
};

export const lineTotalFor = (m: Material | undefined, isFullLoad: boolean, yards: number) => {
  if (!m) return { rate: 0, total: 0 };
  if (isFullLoad) return { rate: Number(m.full_load_price), total: Number(m.full_load_price) };
  const rate = Number(m.price_per_yard);
  return { rate, total: Math.round(rate * (yards || 0) * 100) / 100 };
};

export interface TotalsInput {
  items: LineItemDraft[];
  deliveryType: DeliveryType;
  miles: number;
  customFee: number;
  loads: number;
  settings: Settings | null;
}

export const perLoadFee = ({ deliveryType, miles, customFee, settings }: TotalsInput) => {
  if (!settings) return 0;
  switch (deliveryType) {
    case "tier_1":
      return Number(settings.delivery_tier_1_fee);
    case "tier_2":
      return Number(settings.delivery_tier_2_fee);
    case "tier_3":
      return Number(settings.delivery_tier_3_fee);
    case "over_10": {
      const over = Math.max(0, (miles || 0) - Number(settings.delivery_tier_3_max_miles));
      return Number(settings.delivery_overage_base_fee) + over * Number(settings.delivery_overage_per_mile);
    }
    case "custom":
      return customFee || 0;
    case "pickup":
    default:
      return 0;
  }
};

export const computeTotals = (input: TotalsInput) => {
  const materials_subtotal =
    Math.round(input.items.reduce((sum, i) => sum + (i.line_total || 0), 0) * 100) / 100;
  const fee = perLoadFee(input);
  const loads = Math.max(1, input.loads || 1);
  const delivery_total = Math.round(fee * loads * 100) / 100;
  const tax_rate = Number(input.settings?.tax_rate ?? 0);
  const taxable = input.settings?.tax_applies_to_delivery
    ? materials_subtotal + delivery_total
    : materials_subtotal;
  const tax_amount = Math.round(taxable * (tax_rate / 100) * 100) / 100;
  const grand_total = Math.round((materials_subtotal + delivery_total + tax_amount) * 100) / 100;
  return {
    materials_subtotal,
    delivery_fee_per_load: fee,
    delivery_total,
    tax_rate,
    tax_amount,
    grand_total,
    loads,
  };
};
