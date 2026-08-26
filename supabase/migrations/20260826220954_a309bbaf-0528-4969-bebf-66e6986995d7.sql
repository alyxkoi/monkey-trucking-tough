-- Phase 05 ticket safety: history, corrections, voids, atomic ticket creation.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS client_request_id text,
  ADD COLUMN IF NOT EXISTS tax_applies_to_delivery boolean,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS voided_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_client_request_id_key
  ON public.tickets (client_request_id) WHERE client_request_id IS NOT NULL;

ALTER TABLE public.ticket_items
  ADD COLUMN IF NOT EXISTS loads numeric,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

CREATE TABLE IF NOT EXISTS public.ticket_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  reason text,
  actor_id uuid,
  actor_label text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_history_ticket_id_idx ON public.ticket_history (ticket_id, created_at DESC);

GRANT SELECT, INSERT ON public.ticket_history TO authenticated;
GRANT ALL ON public.ticket_history TO service_role;
ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS phase05_ticket_history_select_staff ON public.ticket_history;
CREATE POLICY phase05_ticket_history_select_staff ON public.ticket_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::app_role,'staff'::app_role])));

DROP POLICY IF EXISTS phase05_ticket_history_insert_staff ON public.ticket_history;
CREATE POLICY phase05_ticket_history_insert_staff ON public.ticket_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::app_role,'staff'::app_role])));

CREATE OR REPLACE FUNCTION public.is_admin_or_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY (ARRAY['admin'::app_role,'staff'::app_role])
  )
$$;

CREATE OR REPLACE FUNCTION public.create_ticket_atomic(
  p_ticket jsonb,
  p_items jsonb,
  p_client_request_id text,
  p_preserve_legacy_unknowns boolean DEFAULT false
) RETURNS SETOF public.tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_num text;
BEGIN
  IF NOT public.is_admin_or_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(p_client_request_id, gen_random_uuid()::text), 0));

  SELECT id INTO v_id FROM public.tickets WHERE client_request_id = p_client_request_id;
  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.tickets WHERE id = v_id;
    RETURN;
  END IF;

  IF coalesce(p_ticket->>'delivery_type', '') = '' THEN
    RAISE EXCEPTION 'delivery selection is required';
  END IF;
  IF NOT p_preserve_legacy_unknowns AND p_ticket->>'tax_applies_to_delivery' IS NULL THEN
    RAISE EXCEPTION 'tax-on-delivery snapshot is required';
  END IF;

  v_num := public.next_ticket_number();

  INSERT INTO public.tickets (
    ticket_number, client_request_id, customer_name, customer_phone, job_site_address,
    driver_id, delivery_type, delivery_miles, delivery_fee_per_load, load_count,
    delivery_total, materials_subtotal, tax_rate, tax_applies_to_delivery, tax_amount,
    grand_total, notes, payment_status, created_by, status
  ) VALUES (
    v_num, p_client_request_id,
    coalesce(p_ticket->>'customer_name',''),
    coalesce(p_ticket->>'customer_phone',''),
    coalesce(p_ticket->>'job_site_address',''),
    nullif(p_ticket->>'driver_id','')::uuid,
    p_ticket->>'delivery_type',
    nullif(p_ticket->>'delivery_miles','')::numeric,
    coalesce(nullif(p_ticket->>'delivery_fee_per_load','')::numeric, 0),
    coalesce(nullif(p_ticket->>'load_count','')::integer, 1),
    coalesce(nullif(p_ticket->>'delivery_total','')::numeric, 0),
    coalesce(nullif(p_ticket->>'materials_subtotal','')::numeric, 0),
    coalesce(nullif(p_ticket->>'tax_rate','')::numeric, 0),
    nullif(p_ticket->>'tax_applies_to_delivery','')::boolean,
    coalesce(nullif(p_ticket->>'tax_amount','')::numeric, 0),
    coalesce(nullif(p_ticket->>'grand_total','')::numeric, 0),
    nullif(p_ticket->>'notes',''),
    coalesce(nullif(p_ticket->>'payment_status',''),'unpaid'),
    auth.uid(), 'active'
  ) RETURNING id INTO v_id;

  INSERT INTO public.ticket_items (ticket_id, material_id, material_name, yards, is_full_load, rate_used, line_total, loads)
  SELECT v_id,
    nullif(item->>'material_id','')::uuid,
    coalesce(item->>'material_name',''),
    coalesce(nullif(item->>'yards','')::numeric, 0),
    coalesce(nullif(item->>'is_full_load','')::boolean, false),
    coalesce(nullif(item->>'rate_used','')::numeric, 0),
    coalesce(nullif(item->>'line_total','')::numeric, 0),
    nullif(item->>'loads','')::numeric
  FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS item;

  INSERT INTO public.ticket_history (ticket_id, event_type, actor_id, actor_label, after_snapshot)
  VALUES (v_id, 'created', auth.uid(), auth.jwt()->>'email', to_jsonb((SELECT t FROM public.tickets t WHERE t.id = v_id)));

  RETURN QUERY SELECT * FROM public.tickets WHERE id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.correct_ticket_atomic(
  p_ticket_id uuid,
  p_reason text,
  p_ticket jsonb,
  p_items jsonb
) RETURNS SETOF public.tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before jsonb; v_status text;
BEGIN
  IF NOT public.is_admin_or_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'a correction reason is required';
  END IF;

  SELECT status, to_jsonb(t) INTO v_status, v_before FROM public.tickets t WHERE t.id = p_ticket_id;
  IF v_before IS NULL THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF v_status = 'void' THEN RAISE EXCEPTION 'a voided ticket cannot be corrected'; END IF;

  UPDATE public.tickets SET
    customer_name = coalesce(p_ticket->>'customer_name', customer_name),
    customer_phone = coalesce(p_ticket->>'customer_phone', customer_phone),
    job_site_address = coalesce(p_ticket->>'job_site_address', job_site_address),
    driver_id = nullif(p_ticket->>'driver_id','')::uuid,
    delivery_type = coalesce(nullif(p_ticket->>'delivery_type',''), delivery_type),
    delivery_miles = nullif(p_ticket->>'delivery_miles','')::numeric,
    delivery_fee_per_load = coalesce(nullif(p_ticket->>'delivery_fee_per_load','')::numeric, delivery_fee_per_load),
    load_count = coalesce(nullif(p_ticket->>'load_count','')::integer, load_count),
    delivery_total = coalesce(nullif(p_ticket->>'delivery_total','')::numeric, delivery_total),
    materials_subtotal = coalesce(nullif(p_ticket->>'materials_subtotal','')::numeric, materials_subtotal),
    tax_rate = coalesce(nullif(p_ticket->>'tax_rate','')::numeric, tax_rate),
    tax_amount = coalesce(nullif(p_ticket->>'tax_amount','')::numeric, tax_amount),
    grand_total = coalesce(nullif(p_ticket->>'grand_total','')::numeric, grand_total),
    tax_applies_to_delivery = CASE
      WHEN tax_applies_to_delivery IS NULL THEN NULL
      ELSE coalesce(nullif(p_ticket->>'tax_applies_to_delivery','')::boolean, tax_applies_to_delivery)
    END,
    notes = nullif(p_ticket->>'notes',''),
    payment_status = coalesce(nullif(p_ticket->>'payment_status',''), payment_status)
  WHERE id = p_ticket_id;

  UPDATE public.ticket_items SET superseded_at = now()
   WHERE ticket_id = p_ticket_id AND superseded_at IS NULL;

  INSERT INTO public.ticket_items (ticket_id, material_id, material_name, yards, is_full_load, rate_used, line_total, loads)
  SELECT p_ticket_id,
    nullif(item->>'material_id','')::uuid,
    coalesce(item->>'material_name',''),
    coalesce(nullif(item->>'yards','')::numeric, 0),
    coalesce(nullif(item->>'is_full_load','')::boolean, false),
    coalesce(nullif(item->>'rate_used','')::numeric, 0),
    coalesce(nullif(item->>'line_total','')::numeric, 0),
    nullif(item->>'loads','')::numeric
  FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS item;

  INSERT INTO public.ticket_history (ticket_id, event_type, reason, actor_id, actor_label, before_snapshot, after_snapshot)
  VALUES (p_ticket_id, 'corrected', btrim(p_reason), auth.uid(), auth.jwt()->>'email', v_before,
          to_jsonb((SELECT t FROM public.tickets t WHERE t.id = p_ticket_id)));

  RETURN QUERY SELECT * FROM public.tickets WHERE id = p_ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_ticket(p_ticket_id uuid, p_reason text)
RETURNS SETOF public.tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before jsonb;
BEGIN
  IF NOT public.is_admin_or_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'a void reason is required';
  END IF;

  SELECT to_jsonb(t) INTO v_before FROM public.tickets t WHERE t.id = p_ticket_id;
  IF v_before IS NULL THEN RAISE EXCEPTION 'ticket not found'; END IF;

  UPDATE public.tickets
     SET status = 'void', voided_at = now(), void_reason = btrim(p_reason), voided_by = auth.uid()
   WHERE id = p_ticket_id;

  INSERT INTO public.ticket_history (ticket_id, event_type, reason, actor_id, actor_label, before_snapshot, after_snapshot)
  VALUES (p_ticket_id, 'voided', btrim(p_reason), auth.uid(), auth.jwt()->>'email', v_before,
          to_jsonb((SELECT t FROM public.tickets t WHERE t.id = p_ticket_id)));

  RETURN QUERY SELECT * FROM public.tickets WHERE id = p_ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ticket_atomic(jsonb, jsonb, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.correct_ticket_atomic(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_ticket(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_staff(uuid) TO authenticated;