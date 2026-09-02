/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { flushQueue, getPendingCount } from "@/lib/admin/tickets";
import { invoiceStatus, loadControlData, type ControlData } from "./data";
import { useDemoMode } from "./demo/DemoMode";

export type NewAction = "menu" | "lead" | "job" | "payment" | null;
export type AttentionItem = {
  id: string;
  rank: number;
  tone: "red" | "warn" | "ice";
  title: string;
  detail: string;
  to: string;
  action: string;
  waitingSince: string;
};

type ControlContextValue = {
  data: ControlData | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  lastSyncAt: number;
  attention: AttentionItem[];
  action: NewAction;
  setAction: (value: NewAction) => void;
  pendingTickets: number;
  syncing: boolean;
};

const ControlContext = createContext<ControlContextValue | null>(null);
export const CONTROL_CENTER_SYNC_INTERVAL_MS = 3 * 60 * 1000;

export function isControlCenterSyncStale(lastSyncAt: number, now = Date.now()) {
  return lastSyncAt === 0 || now - lastSyncAt >= CONTROL_CENTER_SYNC_INTERVAL_MS;
}

function deriveAttention(data: ControlData): AttentionItem[] {
  const now = Date.now();
  const activeSnoozes = new Set(
    data.snoozes.filter((item) => new Date(item.returns_at).getTime() > now).map((item) => item.fingerprint),
  );
  const items: AttentionItem[] = [];

  for (const job of data.jobs) {
    if (job.status !== "CANCELLED" && job.blocked_reason) {
      items.push({
        id: `job-blocked:${job.id}`,
        rank: 10,
        tone: "red",
        title: job.blocked_reason,
        detail: `${data.customers.find((c) => c.id === job.customer_id)?.name ?? "Customer"} · ${job.description}`,
        to: `/admin/jobs/${job.id}?attention=blocked`,
        action: "Call or text",
        waitingSince: job.blocked_at ?? job.updated_at,
      });
    }
  }

  for (const lead of data.leads) {
    const customer = data.customers.find((entry) => entry.id === lead.customer_id);
    const messages = data.messages.filter((message) => message.lead_id === lead.id);
    const latest = messages.at(-1);
    if (latest?.sender_type === "CUSTOMER" && !lead.human_takeover) {
      items.push({
        id: `customer-waiting:${lead.id}`,
        rank: 20,
        tone: "red",
        title: `${customer?.name ?? "Customer"} is waiting`,
        detail: latest.body,
        to: `/admin/leads/${lead.id}?attention=reply`,
        action: "Reply",
        waitingSince: latest.created_at,
      });
    } else if (lead.status === "NEW") {
      items.push({
        id: `new-lead:${lead.id}`,
        rank: 30,
        tone: "ice",
        title: `New lead · ${customer?.name ?? "Customer"}`,
        detail: lead.need,
        to: `/admin/leads/${lead.id}?attention=reply`,
        action: "Open lead",
        waitingSince: lead.created_at,
      });
    } else if (lead.status === "ACTIVE" && now - new Date(lead.updated_at).getTime() > 24 * 60 * 60 * 1000) {
      items.push({
        id: `lead-follow-up:${lead.id}`,
        rank: 70,
        tone: "ice",
        title: `Follow up with ${customer?.name ?? "customer"}`,
        detail: lead.need,
        to: `/admin/leads/${lead.id}?attention=follow-up`,
        action: "Call or text",
        waitingSince: lead.updated_at,
      });
    }
  }

  for (const quote of data.quotes) {
    const customer = data.customers.find((entry) => entry.id === quote.customer_id);
    if (quote.status === "ACCEPTED" && !data.jobs.some((job) => job.quote_id === quote.id)) {
      items.push({
        id: `quote-schedule:${quote.id}`,
        rank: 40,
        tone: "red",
        title: `Schedule ${customer?.name ?? "accepted work"}`,
        detail: `${quote.quote_number} accepted · ${quote.description}`,
        to: `/admin/quotes/${quote.id}?attention=schedule`,
        action: "Schedule job",
        waitingSince: quote.accepted_at ?? quote.updated_at,
      });
    } else if (quote.status === "SENT" && now - new Date(quote.sent_at ?? quote.updated_at).getTime() > 24 * 60 * 60 * 1000) {
      items.push({
        id: `quote-follow-up:${quote.id}`,
        rank: 60,
        tone: "ice",
        title: `Quote follow up · ${customer?.name ?? "Customer"}`,
        detail: `${quote.quote_number} · ${quote.description}`,
        to: `/admin/quotes/${quote.id}?attention=follow-up`,
        action: "Call or text",
        waitingSince: quote.sent_at ?? quote.updated_at,
      });
    }
  }

  for (const invoice of data.invoices) {
    const customer = data.customers.find((entry) => entry.id === invoice.customer_id);
    if (invoice.payment_claimed_at) {
      items.push({
        id: `payment-claim:${invoice.id}`,
        rank: 55,
        tone: "warn",
        title: `${customer?.name ?? "Customer"} says they paid`,
        detail: `Invoice ${invoice.invoice_number} · verify before recording`,
        to: `/admin/money/invoices/${invoice.id}?attention=verify`,
        action: "Verify and record",
        waitingSince: invoice.payment_claimed_at,
      });
    } else if (invoiceStatus(invoice) === "OVERDUE") {
      items.push({
        id: `invoice-overdue:${invoice.id}`,
        rank: 50,
        tone: "red",
        title: `${customer?.name ?? "Invoice"} is overdue`,
        detail: `Invoice ${invoice.invoice_number} · ${invoice.description}`,
        to: `/admin/money/invoices/${invoice.id}?attention=overdue`,
        action: "Call or text",
        waitingSince: invoice.due_at ?? invoice.updated_at,
      });
    }
  }

  return items
    .filter((item) => !activeSnoozes.has(item.id))
    .sort((a, b) => a.rank - b.rank || new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime());
}

export function ControlCenterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const demo = useDemoMode();
  const [action, setAction] = useState<NewAction>(null);
  const [pendingTickets, setPendingTickets] = useState(0);
  const loadDashboardData = useCallback(async () => {
    if (user?.id) {
      await flushQueue(user.id);
      setPendingTickets(getPendingCount(user.id));
    }
    return loadControlData();
  }, [user?.id]);
  const query = useQuery({
    queryKey: ["admin", "control-center"],
    queryFn: loadDashboardData,
    enabled: !demo.enabled,
    retry: false,
  });
  const { refetch } = query;
  const syncInFlight = useRef<Promise<void> | null>(null);
  const lastSuccessfulSyncAt = useRef(query.dataUpdatedAt);

  useEffect(() => {
    lastSuccessfulSyncAt.current = query.dataUpdatedAt;
  }, [query.dataUpdatedAt]);

  const refresh = useCallback(() => {
    if (demo.enabled || !user?.id || !navigator.onLine) return Promise.resolve();
    if (syncInFlight.current) return syncInFlight.current;

    const request = refetch({ cancelRefetch: false }).then((result) => {
      if (result.error) throw result.error;
    });
    syncInFlight.current = request;
    void request.finally(() => {
      if (syncInFlight.current === request) syncInFlight.current = null;
    }).catch(() => undefined);
    return request;
  }, [demo.enabled, refetch, user?.id]);

  useEffect(() => {
    if (demo.enabled) return;
    if (!user?.id) return;
    const update = () => {
      const count = getPendingCount(user.id);
      setPendingTickets(count);
      return count;
    };
    const refreshIfStale = () => {
      const pending = update();
      if (navigator.onLine && (pending > 0 || isControlCenterSyncStale(lastSuccessfulSyncAt.current))) {
        void refresh().catch(() => undefined);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshIfStale();
    };
    update();
    window.addEventListener("online", refreshIfStale);
    window.addEventListener("mt-queue-change", update);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void refresh().catch(() => undefined);
      }
    }, CONTROL_CENTER_SYNC_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", refreshIfStale);
      window.removeEventListener("mt-queue-change", update);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [demo.enabled, refresh, user?.id]);

  const activeData = demo.enabled ? demo.data : query.data ?? null;
  const fixturePending = demo.enabled
    ? demo.data?.tickets.filter((ticket) => ticket.status.toLowerCase() === "pending").length ?? 0
    : pendingTickets;

  const value = useMemo<ControlContextValue>(() => ({
    data: activeData,
    loading: demo.enabled ? demo.data === null : query.isLoading,
    error: demo.enabled ? null : query.error instanceof Error ? query.error : null,
    refresh,
    lastSyncAt: demo.enabled ? 0 : query.dataUpdatedAt,
    attention: activeData ? deriveAttention(activeData) : [],
    action,
    setAction,
    pendingTickets: fixturePending,
    syncing: demo.enabled ? false : query.isFetching,
  }), [action, activeData, demo.data, demo.enabled, fixturePending, query.dataUpdatedAt, query.error, query.isFetching, query.isLoading, refresh]);

  return <ControlContext.Provider value={value}>{children}</ControlContext.Provider>;
}

export function useControlCenter() {
  const value = useContext(ControlContext);
  if (!value) throw new Error("useControlCenter must be used inside ControlCenterProvider");
  return value;
}
