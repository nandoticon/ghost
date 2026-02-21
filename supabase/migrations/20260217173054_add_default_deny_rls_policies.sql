do $$
declare
  t text;
  tables text[] := array['users','projects','project_members','todos','tags','todo_tags','comments','attachments','activity_log'];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=t and policyname='deny_all_' || t
    ) then
      execute format('create policy %I on public.%I as restrictive for all to anon, authenticated using (false) with check (false);', 'deny_all_' || t, t);
    end if;
  end loop;
end $$;;
