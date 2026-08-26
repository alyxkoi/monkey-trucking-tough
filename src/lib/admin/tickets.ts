import { supabase } from "@/integrations/supabase/client";

export interface TicketDraft {
  customer_name: string;
  customer_phone: string;
  job_site_address: string;
  driver_id: string | null;
  delivery_type: string;
  delivery_miles: number | null;
  delivery_fee_per_load: number;
  load_count: number;
  delivery_total: number;
  materials_subtotal: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  notes: string | null;
  items: {
    material_id: string | null;
    material_name: string;
    yards: number;
    is_full_load: boolean;
    rate_used: number;
    line_total: number;
  }[];
}

const QUEUE_KEY = "mt_ticket_queue_v1";

export const getQueue = (): { id: string; draft: TicketDraft; queued_at: string }[] => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
};

const writeQueue = (q: ReturnType<typeof getQueue>) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  window.dispatchEvent(new Event("mt-queue-change"));
};

export const enqueueTicket = (draft: TicketDraft) => {
  const q = getQueue();
  q.push({ id: crypto.randomUUID(), draft, queued_at: new Date().toISOString() });
  writeQueue(q);
};

/** Inserts a ticket + its line items. The ticket number is assigned here, at write time. */
export const insertTicket = async (draft: TicketDraft) => {
  const { items, ...ticket } = draft;
  const { data: number, error: numErr } = await supabase.rpc("next_ticket_number");
  if (numErr) throw numErr;

  const { data: user } = await supabase.auth.getUser();
  const { data: created, error } = await supabase
    .from("tickets")
    .insert({ ...ticket, ticket_number: number as string, created_by: user.user?.id ?? null })
    .select("id, ticket_number")
    .single();
  if (error) throw error;

  if (items.length) {
    const { error: itemErr } = await supabase
      .from("ticket_items")
      .insert(items.map((i) => ({ ...i, ticket_id: created.id })));
    if (itemErr) throw itemErr;
  }
  return created;
};

/** Saves a ticket, falling back to the offline queue when the device has no connection. */
export const saveTicket = async (draft: TicketDraft) => {
  if (!navigator.onLine) {
    enqueueTicket(draft);
    return { queued: true as const };
  }
  try {
    const created = await insertTicket(draft);
    return { queued: false as const, ticket: created };
  } catch (err) {
    if (!navigator.onLine) {
      enqueueTicket(draft);
      return { queued: true as const };
    }
    throw err;
  }
};

export const flushQueue = async () => {
  if (!navigator.onLine) return 0;
  const q = getQueue();
  if (!q.length) return 0;
  let synced = 0;
  const remaining = [...q];
  for (const entry of q) {
    try {
      await insertTicket(entry.draft);
      remaining.splice(
        remaining.findIndex((r) => r.id === entry.id),
        1,
      );
      synced += 1;
    } catch {
      break;
    }
  }
  writeQueue(remaining);
  return synced;
};
