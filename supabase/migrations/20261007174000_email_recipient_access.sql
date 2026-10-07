-- Recheck current recipient identity and target access just before provider submission.
create or replace function public.authorize_email_job(target_job_id uuid,worker_name text)
returns boolean language plpgsql security definer set search_path='' as $$
declare j public.email_jobs%rowtype; n public.notifications%rowtype; actor_id uuid; target_unit uuid; permitted boolean:=false;
  previous_claims text:=current_setting('request.jwt.claims',true);
  previous_sub text:=current_setting('request.jwt.claim.sub',true);
  previous_role text:=current_setting('request.jwt.claim.role',true);
begin
  select * into j from public.email_jobs where id=target_job_id for update;
  if not found or j.status<>'processing' or j.locked_by is distinct from worker_name or j.locked_until<=now() then return false; end if;
  select * into n from public.notifications where id=j.notification_id and property_id=j.property_id;
  select pm.user_id into actor_id from public.property_members pm join auth.users u on u.id=pm.user_id
    where pm.id=n.recipient_member_id and pm.property_id=j.property_id and pm.status='active' and lower(u.email)=lower(j.recipient_email);
  if actor_id is not null then
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role','authenticated')::text,true);
    perform set_config('request.jwt.claim.sub',actor_id::text,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
    if private.is_active_member(j.property_id) then
      if n.type in ('receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice') then
        if j.template_data->>'unit_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then target_unit:=(j.template_data->>'unit_id')::uuid; end if;
        permitted:=private.can_access_unit_finance(j.property_id,target_unit);
      else
        permitted:=case n.target_type
          when 'pqrs' then private.can_read_pqrs(n.target_id)
          when 'package' then private.can_read_package(n.target_id)
          when 'visitor' then private.can_read_visitor(n.target_id)
          when 'reservation' then private.can_read_reservation(n.target_id)
          when 'attention_call' then private.can_read_attention_call(n.target_id)
          when 'assembly' then private.can_read_assembly(n.target_id) and (
            private.is_active_member(j.property_id,'administrator') or exists(
              select 1 from public.assembly_attendees aa join public.unit_memberships um on um.property_id=aa.property_id and um.member_id=aa.member_id and um.unit_id=aa.unit_id
              where aa.assembly_id=n.target_id and aa.member_id=n.recipient_member_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
            ) or exists(
              select 1 from public.assembly_representations ar where ar.assembly_id=n.target_id and ar.status in ('submitted','validated') and (
                ar.representative_member_id=n.recipient_member_id or (ar.grantor_member_id=n.recipient_member_id and exists(
                  select 1 from public.unit_memberships um where um.property_id=ar.property_id and um.member_id=ar.grantor_member_id and um.unit_id=ar.unit_id
                    and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
                ))
              )
            )
          )
          else false end;
      end if;
      if j.template_key='assembly_reminder' then
        permitted:=permitted and exists(select 1 from public.assemblies a where a.id=n.target_id and a.status='scheduled' and a.starts_at>now()
          and (j.template_data->>'starts_at')::timestamptz=a.starts_at);
      end if;
    end if;
  end if;
  perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(previous_role,''),true);
  if not coalesce(permitted,false) then
    update public.email_jobs set status='cancelled',locked_by=null,locked_until=null,last_error_code='recipient_access_revoked' where id=j.id;
  end if;
  return coalesce(permitted,false);
exception when others then
  perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(previous_role,''),true);
  raise;
end;
$$;
revoke all on function public.authorize_email_job(uuid,text) from public,anon,authenticated;
grant execute on function public.authorize_email_job(uuid,text) to service_role;
notify pgrst,'reload schema';
