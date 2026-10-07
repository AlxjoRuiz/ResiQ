-- Verify separate intent/topic and authorization; no test data or emails survive.
begin;
do $test$
declare p uuid; resident uuid; u uuid; q uuid; kind text;
begin
 select um.property_id,pm.user_id,um.unit_id into p,resident,u from public.unit_memberships um join public.property_members pm on pm.id=um.member_id where pm.status='active' and 'member'=any(pm.roles) and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now()) limit 1;
 if resident is null then raise exception 'test_fixture_missing'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',resident,'role','authenticated')::text,true);
 foreach kind in array array['request','complaint','claim','suggestion'] loop
  q:=public.create_pqrs(p,u,'cleaning',kind,'Prueba de clasificación','Descripción de prueba transaccional.');
  if not exists(select 1 from public.pqrs where id=q and request_type=kind and category='cleaning' and author_member_id in(select id from public.property_members where user_id=resident)) then raise exception 'test_classification_failed'; end if;
 end loop;
 begin perform public.create_pqrs(p,u,'complaint','claim','Tema incorrecto','Descripción de prueba transaccional.'); raise exception 'test_invalid_topic_accepted'; exception when others then if sqlerrm<>'invalid_input' then raise; end if; end;
 begin perform public.create_pqrs(p,u,'cleaning','invalid','Tipo incorrecto','Descripción de prueba transaccional.'); raise exception 'test_invalid_type_accepted'; exception when others then if sqlerrm<>'invalid_input' then raise; end if; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 begin perform public.create_pqrs(p,u,'cleaning','claim','Usuario ajeno','Descripción de prueba transaccional.'); raise exception 'test_unauthorized_creation'; exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end; $test$;
rollback;
select 'PASS: tipo y categoría independientes, validación y autorización; pruebas revertidas' as resultado;
