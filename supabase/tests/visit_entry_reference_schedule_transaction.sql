-- Run AFTER 20261008220000_visit_entry_reference_schedule.sql as postgres. All test data rolls back.
begin;
do $test$
declare p uuid; resident uuid; concierge uuid; u uuid; a uuid; b uuid; entry_id uuid; target uuid; blocked_status text;
begin
  select um.property_id,pm.user_id,um.unit_id into p,resident,u
  from public.unit_memberships um join public.property_members pm on pm.id=um.member_id
  where um.property_id='1bde3475-3ed2-4f57-bd13-39784b12d2a6' and pm.status='active'
    and 'member'=any(pm.roles) and not pm.roles&&array['administrator','concierge']
    and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
    and exists(select 1 from public.property_members c where c.property_id=um.property_id and c.status='active' and 'concierge'=any(c.roles)) limit 1;
  select user_id into concierge from public.property_members where property_id=p and status='active' and 'concierge'=any(roles) limit 1;
  if resident is null or concierge is null then raise exception 'test_fixture_missing'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',resident,'role','authenticated')::text,true);
  a:=public.create_visit(p,u,null,'PRUEBA ingreso anticipado','2020','personal','','',now()+interval '2 hours',now()+interval '3 hours',1,'Prueba con rollback','');
  b:=public.create_visit(p,u,null,'PRUEBA ingreso posterior','2020','personal','','',now(),now()+interval '1 hour',1,'Prueba con rollback','');
  -- Test-only fixture setup; production clients cannot write these states directly.
  update public.visitors set status='authorized' where id in(a,b);
  update public.visitors set scheduled_start=now()-interval '3 hours',scheduled_end=now()-interval '2 hours' where id=b;
  begin
    perform public.register_visit_entry(a,''); raise exception 'test_resident_entry_allowed';
  exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',concierge,'role','authenticated')::text,true);
  foreach target in array array[a,b] loop
    entry_id:=public.register_visit_entry(target,'Prueba de horario de referencia');
    if not exists(select 1 from public.visitor_entries where id=entry_id and entered_at=now() and entered_by=concierge) then raise exception 'test_actual_entry_missing'; end if;
    if not exists(select 1 from public.audit_logs where entity_id=target and action='visit.entered' and actor_id=concierge
      and metadata->>'schedule_relation'=case when target=a then 'before_schedule' else 'after_schedule' end) then raise exception 'test_schedule_audit_missing'; end if;
    begin
      perform public.register_visit_entry(target,''); raise exception 'test_duplicate_entry_allowed';
    exception when others then if sqlerrm<>'invalid_transition' then raise; end if; end;
    perform public.register_visit_exit(target,'Salida de prueba');
    if (select status from public.visitors where id=target)<>'exited' then raise exception 'test_exit_failed'; end if;
  end loop;
  foreach blocked_status in array array['pending','rejected','cancelled'] loop
    update public.visitors set status=blocked_status where id=a;
    begin
      perform public.register_visit_entry(a,''); raise exception 'test_unaccepted_entry_allowed';
    exception when others then if sqlerrm<>'invalid_transition' then raise; end if; end;
  end loop;
end;
$test$;
rollback;
select 'PASS: ingreso antes/después, rol, hora real, auditoría y movimiento único; datos revertidos' as resultado;
