-- Approved pilot, synthetic records only. All changes roll back.
begin;
do $test$
declare p uuid:='1bde3475-3ed2-4f57-bd13-39784b12d2a6'; resident uuid; admin uuid; u uuid; q uuid; debt uuid; before_count bigint;
begin
 select pm.user_id,um.unit_id into resident,u from public.property_members pm join public.unit_memberships um on um.member_id=pm.id and um.property_id=pm.property_id where pm.property_id=p and pm.status='active' and 'member'=any(pm.roles) and not pm.roles&&array['administrator','concierge'] and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now()) limit 1;
 select user_id into admin from public.property_members where property_id=p and status='active' and 'administrator'=any(roles) limit 1;
 if resident is null or admin is null then raise exception 'pilot_fixture_missing'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',resident,'role','authenticated')::text,true);
 q:=public.create_pqrs(p,u,'cleaning','request','PRUEBA AUDITORIA PQRS','Registro sintético revertido al terminar la prueba.');
 perform public.add_pqrs_message(q,'Respuesta sintética del residente.');
 if not exists(select 1 from public.audit_logs where entity_id=q and property_id=p and actor_id=resident and action='pqrs.created' and metadata->>'category'='cleaning' and metadata->>'request_type'='request') then raise exception 'pqrs_creation_audit_missing'; end if;
 if not exists(select 1 from public.audit_logs where entity_id=q and actor_id=resident and action='pqrs.message_added' and metadata ? 'message_id') then raise exception 'pqrs_message_audit_missing'; end if;
 select count(*) into before_count from public.audit_logs where entity_id=q;
 begin perform public.change_pqrs_status(q,'in_review'); raise exception 'resident_status_change_allowed'; exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 if (select count(*) from public.audit_logs where entity_id=q)<>before_count then raise exception 'denied_pqrs_action_audited_as_success'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 perform public.change_pqrs_status(q,'in_review');
 if not exists(select 1 from public.audit_logs where entity_id=q and property_id=p and actor_id=admin and action='pqrs.status_changed' and metadata->>'from'='open' and metadata->>'to'='in_review') then
  if not exists(select 1 from public.audit_logs where entity_id=q and property_id=p and actor_id=admin and action='pqrs.status_changed' and metadata->>'to'='in_review' and metadata ? 'from') then raise exception 'pqrs_status_audit_missing'; end if;
 end if;
 debt:=public.create_receivable(p,u,'PRUEBA AUDITORIA REVERTIDA',100,current_date,current_date,null);
 if not exists(select 1 from public.audit_logs where entity_id=debt and property_id=p and actor_id=admin and action='receivable.created' and (metadata->>'amount')::numeric=100 and metadata->>'unit_id'=u::text) then raise exception 'finance_creation_audit_missing'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',resident,'role','authenticated')::text,true);
 begin perform public.void_receivable(debt,'Intento no autorizado'); raise exception 'resident_void_allowed'; exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 perform public.void_receivable(debt,'Anulación sintética de auditoría');
 if not exists(select 1 from public.audit_logs where entity_id=debt and property_id=p and actor_id=admin and action='receivable.voided' and metadata->>'reason'='Anulación sintética de auditoría') then raise exception 'finance_void_audit_missing'; end if;
 if (select count(*) from public.audit_logs where entity_id=debt)<>2 then raise exception 'finance_audit_count_invalid'; end if;
end; $test$;
rollback;
select 'pqrs_and_receivable_audit_passed_rollback' as result;
