import { formatTaxRate, usdExact } from '@/control-center/approved/lib/format'
import { driverName, ticketTotals, totalYards, type Ticket } from '@/control-center/approved/state/ticketsData'
import { deliveryLabel } from '@/control-center/approved/state/pricing'
import { TICKET_LOGO_URL } from '@/lib/admin/print'

/**
 * The printed 4 x 6 thermal label, as documented in the Ticket System Handoff.
 *
 * Pure black on solid white with no gray, because thermal printers cannot print
 * gray and soft edges turn to speckle. Bold type only, hairlines disappear at
 * 1 bit. This is a faithful on screen preview of the real artifact, it is not the
 * print pipeline itself.
 */
export function TicketLabelPreview({
  ticket,
  customerName,
}: {
  ticket: Ticket
  customerName: string
}) {
  const totals = ticketTotals(ticket)
  const created = new Date(ticket.createdAt)

  return (
    <div className="mx-auto w-full max-w-[320px] bg-white p-4 text-black">
      <div className="text-center">
        <img
          src={TICKET_LOGO_URL}
          alt="Monkey Trucking"
          style={{ filter: 'grayscale(1) contrast(1000%)' }}
          className="mx-auto h-12 w-auto max-w-[190px] object-contain"
        />
        <div className="mt-1 font-label text-[9px] font-bold uppercase tracking-[0.12em]">
          Monkey Trucking LLC
        </div>
      </div>

      <div className="mt-2 text-center font-label text-[10px] font-semibold uppercase leading-tight tracking-[0.1em]">
        Kaufman, Texas
        <br />
        monkeytrucking.llc
      </div>

      <div className="mt-3 flex items-end justify-between border-t-2 border-black pt-2">
        <span className="font-display text-[26px] leading-none">
          {ticket.number ?? 'PENDING'}
        </span>
        <span className="text-right font-label text-[10px] font-semibold uppercase leading-tight tracking-[0.08em]">
          {created.toLocaleDateString('en-US')}
          <br />
          {created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-black pt-2">
        <div>
          <div className="font-label text-[9px] font-semibold uppercase tracking-[0.12em]">
            Customer
          </div>
          <div className="text-[11px] font-bold leading-tight">{customerName}</div>
        </div>
        <div>
          <div className="font-label text-[9px] font-semibold uppercase tracking-[0.12em]">
            Job site
          </div>
          <div className="text-[11px] font-bold leading-tight">{ticket.address}</div>
        </div>
      </div>

      <div className="mt-2 border-t border-black pt-2">
        {ticket.materialLines.map((line) => (
          <div key={line.id} className="mb-1.5 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-bold leading-tight">{line.materialName}</div>
              <div className="font-label text-[9px] font-semibold uppercase tracking-[0.08em]">
                {line.yards} YD
                {line.isFullLoad && line.loads !== null && ` / ${line.loads} FULL LOAD${line.loads > 1 ? 'S' : ''}`}
              </div>
            </div>
            <div className="shrink-0 text-[11px] font-bold">{usdExact(line.lineTotal)}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-black pt-2 font-label text-[10px] font-semibold uppercase tracking-[0.08em]">
        <Row label="Subtotal" value={usdExact(totals.materials)} />
        <Row
          label={`Delivery, ${deliveryLabel(ticket.delivery)}`}
          value={usdExact(totals.delivery)}
        />
        <Row label={`Tax ${formatTaxRate(totals.taxRate)}`} value={usdExact(totals.tax)} />
      </div>

      <div className="mt-2 flex items-end justify-between border-t-2 border-black pt-2">
        <span className="font-label text-[12px] font-semibold uppercase tracking-[0.12em]">
          Total
        </span>
        <span className="font-display text-[30px] leading-none">{usdExact(totals.total)}</span>
      </div>

      <div className="mt-3 border-t border-black pt-2">
        <div className="font-label text-[9px] font-semibold uppercase tracking-[0.12em]">
          Driver
        </div>
        <div className="text-[11px] font-bold">{driverName(ticket.driverId)}</div>
        <div className="mt-4 border-b border-black" />
        <div className="mt-1 font-label text-[9px] font-semibold uppercase tracking-[0.12em]">
          Received by
        </div>
      </div>

      <div className="mt-3 text-center font-label text-[10px] font-semibold uppercase tracking-[0.1em]">
        {totalYards(ticket)} yards total. Thank you.
      </div>

      {/* Blank tail so the cutter cannot clip the last line. */}
      <div className="h-6" />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  )
}
