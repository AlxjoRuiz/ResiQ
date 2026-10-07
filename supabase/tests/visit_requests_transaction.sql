-- Run in SQL Editor as postgres against the approved pilot fixtures. Everything rolls back.
begin;
do $test$
declare p uuid; resident uuid; admin uuid; u uuid; a uuid; b uuid;
begin
  select um.property_id,pm.user_id,um.unit_id into p,resident,u
  from public.unit_memberships um join public.property_members pm on pm.id=um.member_id
  where pm.status='active' and 'member'=any(pm.roles) and not pm.roles&&array['administrator','concierge']
    and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
    and exists(select 1 from public.property_members adm where adm.property_id=um.property_id and adm.status='active' and 'administrator'=any(adm.roles)) limit 1;
  select user_id into admin from public.property_members where property_id=p and status='active' and 'administrator'=any(roles) limit 1;
  if resident is null or admin is null then raise exception 'test_fixture_missing'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',resident,'role','authenticated')::text,true);
  a:=public.create_visit(p,u,null,'Prueba solicitud aceptada',null,'personal','','',now(),now()+interval '1 hour',1,'Prueba transaccional','');
  b:=public.create_visit(p,u,null,'Prueba solicitud rechazada',null,'personal','','',now(),now()+interval '1 hour',1,'Prueba transaccional','');
  if (select status from public.visitors where id=a)<>'pending' then raise exception 'test_expected_pending'; end if;
  begin perform public.review_visit(a,true,''); raise exception 'test_resident_review_allowed'; exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
  begin perform public.create_visit(p,u,null,'Prueba admin',null,'personal','','',now(),now()+interval '1 hour',1,'',''); raise exception 'test_admin_create_allowed'; exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
  begin perform public.register_visit_entry(a,''); raise exception 'test_admin_entry_allowed'; exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
  begin perform public.review_visit(b,false,''); raise exception 'test_empty_rejection_allowed'; exception when others then if sqlerrm<>'invalid_input' then raise; end if; end;
  perform public.review_visit(a,true,''); perform public.review_visit(b,false,'Rechazo de prueba');
  if (select status from public.visitors where id=a)<>'authorized' or (select status from public.visitors where id=b)<>'rejected' then raise exception 'test_review_failed'; end if;
  begin perform public.review_visit(a,false,'Otra decisión'); raise exception 'test_double_review_allowed'; exception when others then if sqlerrm<>'invalid_transition' then raise; end if; end;
  update public.property_members set roles=array['concierge'] where property_id=p and user_id=admin;
  begin perform public.create_visit(p,u,null,'Prueba portería',null,'personal','','',now(),now()+interval '1 hour',1,'',''); raise exception 'test_concierge_create_allowed'; exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
  begin perform public.review_visit(b,true,''); raise exception 'test_concierge_review_allowed'; exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
  begin perform public.register_visit_entry(b,''); raise exception 'test_rejected_entry_allowed'; exception when others then if sqlerrm<>'invalid_transition' then raise; end if; end;
  perform public.register_visit_entry(a,'Ingreso de prueba'); perform public.register_visit_exit(a,'Salida de prueba');
  if (select status from public.visitors where id=a)<>'exited' then raise exception 'test_exit_failed'; end if;
end; $test$;
rollback;
select 'PASS: solicitudes, decisiones, permisos y movimientos; datos revertidos' as resultado;
