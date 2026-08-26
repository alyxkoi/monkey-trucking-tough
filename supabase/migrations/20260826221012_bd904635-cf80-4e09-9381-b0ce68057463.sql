REVOKE EXECUTE ON FUNCTION public.create_ticket_atomic(jsonb, jsonb, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.correct_ticket_atomic(uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.void_ticket(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_ticket_number() FROM PUBLIC, anon, authenticated;