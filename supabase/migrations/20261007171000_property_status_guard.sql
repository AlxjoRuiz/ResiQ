-- Tenant status must gate direct table access and security-definer mutations alike.
create or replace function private.require_active_property_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_property uuid; current_status text;
begin
  if auth.uid() is not null then
    target_property:=case when tg_op='DELETE' then old.property_id else new.property_id end;
    select status into current_status from public.properties where id=target_property for share;
    if current_status is distinct from 'active' then raise exception 'property_inactive'; end if;
    if tg_op='UPDATE' and old.property_id is distinct from new.property_id then
      select status into current_status from public.properties where id=old.property_id for share;
      if current_status is distinct from 'active' then raise exception 'property_inactive'; end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.require_active_property_write() from public,anon,authenticated;

do $$ declare target_table text; begin
  for target_table in
    select t.table_name from information_schema.tables t
    join information_schema.columns c on c.table_schema=t.table_schema and c.table_name=t.table_name and c.column_name='property_id'
    where t.table_schema='public' and t.table_type='BASE TABLE'
  loop
    execute format('create policy active_property_access on public.%I as restrictive for all to authenticated using(private.is_active_member(property_id)) with check(private.is_active_member(property_id))',target_table);
    execute format('create trigger require_active_property_write before insert or update or delete on public.%I for each row execute function private.require_active_property_write()',target_table);
  end loop;
end $$;

create policy storage_active_property_read on storage.objects as restrictive for select to authenticated
using(bucket_id<>'private-documents' or exists(select 1 from public.documents d where d.bucket=bucket_id and d.object_path=name and private.is_active_member(d.property_id)));
create policy storage_active_property_insert on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'private-documents' or exists(select 1 from public.documents d where d.bucket=bucket_id and d.object_path=name and private.is_active_member(d.property_id)));

create or replace function public.get_assembly_representative_options(target_assembly_id uuid)
returns table(member_id uuid,display_name text)
language sql stable security definer set search_path='' as $$
  select pm.id,p.display_name
  from public.assemblies a join public.property_members pm on pm.property_id=a.property_id and pm.status='active' and 'member'=any(pm.roles)
  join public.profiles p on p.id=pm.user_id
  where a.id=target_assembly_id and private.is_active_member(a.property_id) and a.published_at is not null and private.can_read_assembly(a.id)
  order by p.display_name;
$$;
notify pgrst,'reload schema';
