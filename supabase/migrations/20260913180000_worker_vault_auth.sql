begin;

-- Keep the dedicated random worker credential in Vault only. The caller sends
-- a SHA-256 digest to this service-only verifier, never reads decrypted secrets.
create function public.verify_communications_worker(p_token_hash text)
returns boolean language plpgsql stable security definer
set search_path=public,pg_temp as $$
declare expected_hash text;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  select encode(sha256(convert_to(decrypted_secret,'UTF8')),'hex') into expected_hash
    from vault.decrypted_secrets where name='communications_worker_secret';
  return coalesce(expected_hash=p_token_hash,false);
end $$;
revoke all on function public.verify_communications_worker(text) from public,anon,authenticated;
grant execute on function public.verify_communications_worker(text) to service_role;

commit;
