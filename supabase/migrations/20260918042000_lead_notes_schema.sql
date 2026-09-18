-- Complete the existing lead-specific Notes architecture. LeadDetail already
-- saves this field through updateLead, and both quote preparation RPCs snapshot
-- it into quotes.notes. Customer notes remain profile-wide; activity_history is
-- an audit trail, not the editable note. Do not copy either into a quote.
-- Nullable/no backfill: existing leads have no stored lead notes to recover.
alter table public.leads add column if not exists notes text;
comment on column public.leads.notes is
  'Lead-specific editable notes; snapshotted into quote notes when a draft is created. Separate from customer profile notes and job notes.';
