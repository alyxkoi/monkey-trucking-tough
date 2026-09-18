type Audit = { tool_results?: unknown; error_message?: string | null; latency_ms?: number | null }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const stages: [string, string][] = [
  ['provider_to_webhook_ms', 'Provider occurrence → webhook'], ['ingestion_ms', 'Inbound database commit'],
  ['provider_to_ingest_ms', 'Provider occurrence → ingestion'], ['queue_wait_ms', 'Job created → worker'],
  ['context_load_ms', 'Database context'], ['address_parse_ms', 'Address parsing'], ['google_routes_ms', 'Google Routes'],
  ['deterministic_pricing_ms', 'Pricing'], ['openai_ms', 'OpenAI (including retries)'], ['lifecycle_apply_ms', 'Lifecycle writes'],
  ['outbox_reservation_ms', 'Outbox reservation'], ['dispatch_authorization_ms', 'Send authorization'],
  ['provider_submit_ms', 'Provider submission'], ['dispatch_commit_ms', 'Send receipt saved'], ['worker_total_ms', 'Worker total'],
]
/** Staff route only; no diagnostics enter a customer message/document. */
export function CommunicationDiagnostics({ audit }: { audit?: Audit }) {
  if (!audit) return null
  const tools = object(audit.tool_results), timings = object(tools.timings)
  return <details className="rounded-xl border border-line p-4 text-sm">
    <summary className="cursor-pointer py-2 font-semibold">Staff response diagnostics</summary>
    <p className="mt-3 text-cc-muted">Provider time is separate from AI time. Missing timings were not recorded by that backend version. Submission is not proof of delivery; see the message status.</p>
    <p className="mt-2">Inbound path: {typeof timings.ingress_source==='string'?timings.ingress_source:'Not recorded'}</p>
    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
      {stages.map(([key, label]) => <div key={key}><dt className="text-cc-muted">{label}</dt><dd className="font-mono">{typeof timings[key] === 'number' ? `${(Number(timings[key]) / 1000).toFixed(2)} s` : 'Not recorded'}</dd></div>)}
    </dl>
    {typeof timings.openai_skipped_reason === 'string' && <p className="mt-3">{timings.openai_skipped_reason}</p>}
    {audit.error_message && <p className="mt-3 break-words text-mt-red">{audit.error_message}</p>}
    <details className="mt-3"><summary className="cursor-pointer py-2">Exact timing and tool details</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(tools,null,2)}</pre></details>
  </details>
}
