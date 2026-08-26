import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

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
  tax_applies_to_delivery: boolean | null;
  tax_amount: number;
  grand_total: number;
  notes: string | null;
  payment_status?: string;
  items: {
    source_item_id?: string;
    material_id: string | null;
    material_name: string;
    yards: number;
    is_full_load: boolean;
    rate_used: number;
    line_total: number;
    loads: number | null;
  }[];
}

interface LegacyTicketDraft extends Omit<TicketDraft, "tax_applies_to_delivery" | "items"> {
  tax_applies_to_delivery?: boolean | null;
  items: Array<Omit<TicketDraft["items"][number], "loads"> & { loads?: number | null }>;
}

export interface QueueEntry {
  id: string;
  draft: TicketDraft;
  queued_at: string;
  attempts: number;
  last_error: string | null;
}

interface LegacyQueueEntry {
  id: string;
  draft: LegacyTicketDraft;
  queued_at: string;
}

export const LEGACY_QUEUE_KEY = "mt_ticket_queue_v1";
const QUEUE_PREFIX = "mt_ticket_queue_v2";

export const queueKeyForUser = (userId: string) => `${QUEUE_PREFIX}:${userId}`;

const parseQueue = <T>(key: string): T[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const dispatchQueueChange = () => window.dispatchEvent(new Event("mt-queue-change"));

const writeQueue = (key: string, entries: unknown[]) => {
  localStorage.setItem(key, JSON.stringify(entries));
  dispatchQueueChange();
};

export const getLegacyQueue = () => parseQueue<LegacyQueueEntry>(LEGACY_QUEUE_KEY);
export const getQueue = (userId: string) => parseQueue<QueueEntry>(queueKeyForUser(userId));
export const getPendingCount = (userId: string) => getLegacyQueue().length + getQueue(userId).length;

const normalizeLegacyDraft = (draft: LegacyTicketDraft): TicketDraft => ({
  ...draft,
  tax_applies_to_delivery: draft.tax_applies_to_delivery ?? null,
  items: draft.items.map((item) => ({ ...item, loads: item.loads ?? null })),
});

export const enqueueTicket = (draft: TicketDraft, userId: string, requestId = crypto.randomUUID()) => {
  const entries = getQueue(userId);
  entries.push({
    id: requestId,
    draft,
    queued_at: new Date().toISOString(),
    attempts: 0,
    last_error: null,
  });
  writeQueue(queueKeyForUser(userId), entries);
  return requestId;
};

export const ticketRpcPayload = (draft: TicketDraft) => {
  const { items, ...ticket } = draft;
  return { ticket: ticket as unknown as Json, items: items as unknown as Json };
};

/**
 * Allocates the MT number and inserts the ticket and items in one server-side
 * transaction. Reusing requestId returns the original ticket without consuming
 * another number.
 */
export const insertTicket = async (
  draft: TicketDraft,
  requestId: string,
  preserveLegacyUnknowns = false,
) => {
  const payload = ticketRpcPayload(draft);
  const { data, error } = await supabase.rpc("create_ticket_atomic", {
    p_ticket: payload.ticket,
    p_items: payload.items,
    p_client_request_id: requestId,
    p_preserve_legacy_unknowns: preserveLegacyUnknowns,
  });
  if (error) throw error;
  const created = data?.[0];
  if (!created) throw new Error("Ticket save returned no record.");
  return created;
};

export const correctTicket = async (ticketId: string, reason: string, draft: TicketDraft) => {
  const payload = ticketRpcPayload(draft);
  const { data, error } = await supabase.rpc("correct_ticket_atomic", {
    p_ticket_id: ticketId,
    p_reason: reason,
    p_ticket: payload.ticket,
    p_items: payload.items,
  });
  if (error) throw error;
  const corrected = data?.[0];
  if (!corrected) throw new Error("Ticket correction returned no record.");
  return corrected;
};

export const voidTicket = async (ticketId: string, reason: string) => {
  const { data, error } = await supabase.rpc("void_ticket", {
    p_ticket_id: ticketId,
    p_reason: reason,
  });
  if (error) throw error;
  const voided = data?.[0];
  if (!voided) throw new Error("Ticket void returned no record.");
  return voided;
};

export const isRetryableNetworkError = (error: unknown) => {
  if (!navigator.onLine) return true;
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : String(error);
  return /failed to fetch|network|load failed|connection|timeout/i.test(message);
};

/** Saves a new ticket, falling back to the account-scoped queue on connection failure. */
export const saveTicket = async (draft: TicketDraft, userId: string) => {
  const requestId = crypto.randomUUID();
  if (!navigator.onLine) {
    enqueueTicket(draft, userId, requestId);
    return { queued: true as const, requestId };
  }
  try {
    const ticket = await insertTicket(draft, requestId);
    return { queued: false as const, ticket, requestId };
  } catch (error) {
    if (isRetryableNetworkError(error)) {
      enqueueTicket(draft, userId, requestId);
      return { queued: true as const, requestId };
    }
    throw error;
  }
};

const errorMessage = (error: unknown) => error instanceof Error
  ? error.message
  : typeof error === "object" && error && "message" in error
    ? String(error.message)
    : "Sync failed";

/**
 * Drains unscoped v1 records first, preserving their unknown item loads and tax
 * rule as null. New v2 entries are read only from the signed-in user's key.
 */
export const flushQueue = async (userId: string) => {
  if (!navigator.onLine) return 0;
  let synced = 0;

  const legacyEntries = getLegacyQueue();
  const legacyRemaining = [...legacyEntries];
  for (const entry of legacyEntries) {
    try {
      await insertTicket(normalizeLegacyDraft(entry.draft), entry.id, true);
      const index = legacyRemaining.findIndex((candidate) => candidate.id === entry.id);
      if (index >= 0) legacyRemaining.splice(index, 1);
      writeQueue(LEGACY_QUEUE_KEY, legacyRemaining);
      synced += 1;
    } catch {
      return synced;
    }
  }

  const key = queueKeyForUser(userId);
  const entries = getQueue(userId);
  const remaining = [...entries];
  for (const entry of entries) {
    try {
      await insertTicket(entry.draft, entry.id);
      const index = remaining.findIndex((candidate) => candidate.id === entry.id);
      if (index >= 0) remaining.splice(index, 1);
      writeQueue(key, remaining);
      synced += 1;
    } catch (error) {
      const index = remaining.findIndex((candidate) => candidate.id === entry.id);
      if (index >= 0) {
        remaining[index] = {
          ...remaining[index],
          attempts: remaining[index].attempts + 1,
          last_error: errorMessage(error),
        };
        writeQueue(key, remaining);
      }
      return synced;
    }
  }

  return synced;
};
