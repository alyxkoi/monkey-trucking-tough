-- Finding: SECURITY DEFINER function executable by signed-in users.
-- public.is_admin_or_staff(uuid) let any signed-in user probe whether an
-- arbitrary account has admin/staff privileges, because SECURITY DEFINER
-- bypassed the owner-only SELECT policy on public.user_roles.
-- No RLS policy uses this overload (all 61 policies use the no-arg version).
-- Its only callers are SECURITY DEFINER routines, which already execute with
-- owner privileges, so SECURITY INVOKER keeps them working while direct calls
-- from signed-in users are now constrained by user_roles RLS (own rows only).
ALTER FUNCTION public.is_admin_or_staff(uuid) SECURITY INVOKER;
ALTER FUNCTION public.is_admin_or_staff(uuid) SET search_path = public;