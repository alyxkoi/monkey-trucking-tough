import SignOutButton from "@/components/admin/SignOutButton";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/admin/calc";
import type { Tables } from "@/integrations/supabase/types";

type Ticket = Tables<"tickets">;
type Range = "this" | "last" | "all";

const monthBounds = (offset: number) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
  return { start, end };
};

const AdminTickets = () => {
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<Range>("this");
  const [openPill, setOpenPill] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["admin", "tickets"],
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tickets").update({ payment_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] }),
  });

  const thisMonth = useMemo(() => {
    const { start, end } = monthBounds(0);
    const rows = tickets.filter((t) => {
      const d = new Date(t.created_at);
      return d >= start && d < end;
    });
    return {
      revenue: rows.reduce((s, t) => s + Number(t.grand_total), 0),
      count: rows.length,
    };
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = tickets;
    if (range !== "all") {
      const { start, end } = monthBounds(range === "this" ? 0 : 1);
      rows = rows.filter((t) => {
        const d = new Date(t.created_at);
        return d >= start && d < end;
      });
    }
    if (q) {
      rows = rows.filter((t) =>
        [t.customer_name, t.ticket_number, t.job_site_address]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return rows;
  }, [tickets, search, range]);

  return (
    <main className="adm-screen px-4 pt-6 lg:px-0 lg:pt-2">
      <div className="flex items-center justify-between gap-3">
        <h1 className="adm-title" style={{ fontSize: 32 }}>
          Delivery Tickets
        </h1>
        <SignOutButton />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="adm-panel p-4">
          <span className="adm-label">Revenue this month</span>
          <span className="adm-num block" style={{ fontSize: 28 }}>
            {money(thisMonth.revenue)}
          </span>
        </div>
        <div className="adm-panel p-4">
          <span className="adm-label">Tickets this month</span>
          <span className="adm-num block" style={{ fontSize: 28 }}>
            {thisMonth.count}
          </span>
        </div>
      </div>

      <Link to="/admin/new" className="adm-btn adm-btn-red mt-4 w-full">
        <Plus size={20} /> New ticket
      </Link>

      <div className="relative mt-6">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
          style={{ color: "var(--adm-text-2)" }}
        />
        <input
          className="adm-input"
          style={{ paddingLeft: 44 }}
          placeholder="Search name, ticket #, job site"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search tickets"
        />
      </div>

      <div className="mt-3 flex gap-2">
        {(
          [
            ["this", "This month"],
            ["last", "Last month"],
            ["all", "All time"],
          ] as [Range, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="adm-btn adm-btn-seg"
            data-on={range === value}
            style={{ fontSize: 14, padding: "0 10px" }}
            onClick={() => setRange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {isLoading && <p className="adm-meta">Loading…</p>}

        {!isLoading && tickets.length === 0 && (
          <div className="py-16 text-center">
            <p className="adm-meta">No tickets yet. Create the first one.</p>
            <Link to="/admin/new" className="adm-btn adm-btn-red mt-6 w-full">
              <Plus size={20} /> New ticket
            </Link>
          </div>
        )}

        {!isLoading && tickets.length > 0 && filtered.length === 0 && (
          <p className="adm-meta py-10 text-center">No tickets match that filter.</p>
        )}

        {filtered.map((t) => {
          const paid = t.payment_status === "paid";
          return (
            <div key={t.id} className="adm-panel flex items-start gap-3 p-4">
              <Link to={`/admin/ticket/${t.id}`} className="min-w-0 flex-1">
                <p className="adm-label" style={{ marginBottom: 4, color: "var(--adm-text)" }}>
                  {t.ticket_number} · {new Date(t.created_at).toLocaleDateString("en-US")}
                </p>
                <p className="truncate" style={{ fontSize: 16 }}>
                  {t.customer_name || "—"}
                </p>
              </Link>
              <div className="relative flex flex-col items-end gap-2">
                <span className="adm-num" style={{ fontSize: 22 }}>
                  {money(Number(t.grand_total))}
                </span>
                <button
                  type="button"
                  className={`adm-pill ${paid ? "adm-pill-paid" : "adm-pill-unpaid"}`}
                  onClick={() => setOpenPill(openPill === t.id ? null : t.id)}
                >
                  {paid ? "Paid" : "Unpaid"}
                </button>
                {openPill === t.id && (
                  <div
                    className="adm-panel absolute right-0 top-full z-20 mt-2 w-32 overflow-hidden"
                    style={{ background: "var(--adm-raised)" }}
                  >
                    {["paid", "unpaid"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="adm-label block w-full px-3 text-left"
                        style={{ minHeight: 48, margin: 0, lineHeight: "48px", color: "var(--adm-text)" }}
                        onClick={() => {
                          setOpenPill(null);
                          setStatus.mutate({ id: t.id, status: s });
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
};

export default AdminTickets;
