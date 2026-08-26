import { beforeEach, describe, expect, it, vi } from "vitest";
import { legacyQueueEntry, safeTicketDraft } from "@/test/fixtures/ticketFixtures";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

import {
  LEGACY_QUEUE_KEY,
  enqueueTicket,
  flushQueue,
  getQueue,
  insertTicket,
  queueKeyForUser,
  saveTicket,
  ticketRpcPayload,
} from "@/lib/admin/tickets";

const userA = "00000000-0000-4000-8000-0000000000a1";
const userB = "00000000-0000-4000-8000-0000000000b2";

describe("Ticket snapshot and offline safety", () => {
  beforeEach(() => {
    localStorage.clear();
    rpcMock.mockReset();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("passes the same idempotency key to the atomic RPC", async () => {
    rpcMock.mockResolvedValue({
      data: [{ id: "ticket-id", ticket_number: "MT1102", created: true }],
      error: null,
    });

    const requestId = "00000000-0000-4000-8000-00000000cafe";
    await insertTicket(safeTicketDraft, requestId);
    await insertTicket(safeTicketDraft, requestId);

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls[0][1].p_client_request_id).toBe(requestId);
    expect(rpcMock.mock.calls[1][1].p_client_request_id).toBe(requestId);
  });

  it("preserves pricing, material load and tax snapshots in the RPC payload", () => {
    const payload = ticketRpcPayload(safeTicketDraft);
    expect(payload.ticket).toMatchObject({
      load_count: 5,
      tax_rate: 8.25,
      tax_applies_to_delivery: true,
      grand_total: 3637.2,
    });
    expect(payload.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ material_name: "Flexbase", loads: 3, rate_used: 720, line_total: 2160 }),
      expect.objectContaining({ material_name: "Crushed Concrete", loads: 2, rate_used: 350, line_total: 700 }),
    ]));
  });

  it("scopes every new queue to the signed-in account", () => {
    enqueueTicket(safeTicketDraft, userA, "00000000-0000-4000-8000-0000000000a1");
    enqueueTicket(safeTicketDraft, userB, "00000000-0000-4000-8000-0000000000b2");

    expect(getQueue(userA)).toHaveLength(1);
    expect(getQueue(userB)).toHaveLength(1);
    expect(queueKeyForUser(userA)).not.toBe(queueKeyForUser(userB));
  });

  it("queues a complete new snapshot without allocating a number while offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });

    const result = await saveTicket(safeTicketDraft, userA);

    expect(result.queued).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(getQueue(userA)).toEqual([
      expect.objectContaining({
        id: result.requestId,
        draft: safeTicketDraft,
        attempts: 0,
        last_error: null,
      }),
    ]);
  });

  it("keeps a failed scoped entry with retry history", async () => {
    enqueueTicket(safeTicketDraft, userA, "00000000-0000-4000-8000-00000000dead");
    rpcMock.mockResolvedValue({ data: null, error: { message: "temporary timeout" } });

    await expect(flushQueue(userA)).resolves.toBe(0);
    expect(getQueue(userA)).toEqual([
      expect.objectContaining({ attempts: 1, last_error: "temporary timeout" }),
    ]);
  });

  it("drains v1 entries without inventing item loads or a tax rule", async () => {
    localStorage.setItem(LEGACY_QUEUE_KEY, JSON.stringify([legacyQueueEntry]));
    rpcMock.mockResolvedValue({
      data: [{ id: "legacy-ticket", ticket_number: "MT1103", created: true }],
      error: null,
    });

    await expect(flushQueue(userA)).resolves.toBe(1);
    expect(JSON.parse(localStorage.getItem(LEGACY_QUEUE_KEY) || "[]")).toEqual([]);

    const args = rpcMock.mock.calls[0][1];
    expect(args.p_client_request_id).toBe(legacyQueueEntry.id);
    expect(args.p_preserve_legacy_unknowns).toBe(true);
    expect(args.p_ticket.tax_applies_to_delivery).toBeNull();
    expect(args.p_items[0].loads).toBeNull();
  });
});
