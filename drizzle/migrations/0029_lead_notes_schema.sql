alter table public.leads add column if not exists notes text;
comment on column public.leads.notes is
  'Lead-specific editable notes; snapshotted into quote notes when a draft is created. Separate from customer profile notes and job notes.';
