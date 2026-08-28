-- The email dispatch functions expect these pgmq queues to exist; without them
-- enqueue_email fails with relation "pgmq.q_transactional_emails" does not exist.
do $$
begin
  if not exists (select 1 from pg_tables where schemaname = 'pgmq' and tablename = 'q_transactional_emails') then
    perform pgmq.create('transactional_emails');
  end if;
  if not exists (select 1 from pg_tables where schemaname = 'pgmq' and tablename = 'q_auth_emails') then
    perform pgmq.create('auth_emails');
  end if;
end
$$;