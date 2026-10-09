-- Run after 20261009200000_announcements.sql. All fixture data is rolled back.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
 ('15a00000-0000-4000-8000-000000000001','ann-admin@resiq.invalid','{}'),
 ('15a00000-0000-4000-8000-000000000002','ann-resident@resiq.invalid','{}'),
 ('15a00000-0000-4000-8000-000000000003','ann-outsider@resiq.invalid','{}');
insert into public.properties(id,name,slug,created_by) values
 ('15a10000-0000-4000-8000-000000000001','Announcement fixture','announcement-fixture','15a00000-0000-4000-8000-000000000001'),
 ('15a10000-0000-4000-8000-000000000002','Other announcement fixture','other-announcement-fixture','15a00000-0000-4000-8000-000000000003');
insert into public.property_members(id,property_id,user_id,roles,created_by) values
 ('15a20000-0000-4000-8000-000000000001','15a10000-0000-4000-8000-000000000001','15a00000-0000-4000-8000-000000000001',array['administrator'],'15a00000-0000-4000-8000-000000000001'),
 ('15a20000-0000-4000-8000-000000000002','15a10000-0000-4000-8000-000000000001','15a00000-0000-4000-8000-000000000002',array['member'],'15a00000-0000-4000-8000-000000000001'),
 ('15a20000-0000-4000-8000-000000000003','15a10000-0000-4000-8000-000000000002','15a00000-0000-4000-8000-000000000003',array['administrator'],'15a00000-0000-4000-8000-000000000003');

select set_config('request.jwt.claims','{"sub":"15a00000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','15a00000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('stage15.announcement',public.save_announcement_draft(
 '15a10000-0000-4000-8000-000000000001',null,'Asunto de prueba','Mensaje interno de prueba para una persona.',
 array['15a20000-0000-4000-8000-000000000002']::uuid[])::text,true);
reset role;

-- A recipient cannot inspect the draft or its audience.
select set_config('request.jwt.claims','{"sub":"15a00000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','15a00000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $test$ begin
 if exists(select 1 from public.announcements where id=current_setting('stage15.announcement')::uuid) then raise exception 'recipient_can_read_draft'; end if;
 if exists(select 1 from public.announcement_recipients where announcement_id=current_setting('stage15.announcement')::uuid) then raise exception 'recipient_can_read_draft_audience'; end if;
 begin
  perform public.publish_announcement(current_setting('stage15.announcement')::uuid);
  raise exception 'resident_published';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

-- A member of another property cannot publish or read it.
select set_config('request.jwt.claims','{"sub":"15a00000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','15a00000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $test$ begin
 if exists(select 1 from public.announcements where id=current_setting('stage15.announcement')::uuid) then raise exception 'cross_property_draft_visible'; end if;
 begin
  perform public.publish_announcement(current_setting('stage15.announcement')::uuid);
  raise exception 'outsider_published';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"15a00000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','15a00000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.publish_announcement(current_setting('stage15.announcement')::uuid);
select public.publish_announcement(current_setting('stage15.announcement')::uuid);
do $test$ begin
 begin
  perform public.save_announcement_draft('15a10000-0000-4000-8000-000000000001',current_setting('stage15.announcement')::uuid,'Changed subject','Changed published body.',array['15a20000-0000-4000-8000-000000000002']::uuid[]);
  raise exception 'published_edited';
 exception when others then if sqlerrm<>'invalid_transition' then raise; end if; end;
end $test$;
reset role;

do $test$ begin
 if (select count(*) from public.notifications where target_type='announcement' and target_id=current_setting('stage15.announcement')::uuid and recipient_member_id='15a20000-0000-4000-8000-000000000002')<>1 then raise exception 'notice_missing_or_duplicated'; end if;
 if exists(select 1 from public.email_jobs ej join public.notifications n on n.id=ej.notification_id where n.target_id=current_setting('stage15.announcement')::uuid) then raise exception 'email_queued_before_domain'; end if;
end $test$;

select set_config('request.jwt.claims','{"sub":"15a00000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','15a00000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $test$ begin
 if not exists(select 1 from public.announcements where id=current_setting('stage15.announcement')::uuid and status='published') then raise exception 'recipient_cannot_read_published'; end if;
 if not exists(select 1 from public.notifications where target_id=current_setting('stage15.announcement')::uuid and read_at is null) then raise exception 'recipient_notice_not_visible'; end if;
end $test$;
update public.notifications set read_at=now() where target_id=current_setting('stage15.announcement')::uuid;
do $test$ begin
 if not exists(select 1 from public.notifications where target_id=current_setting('stage15.announcement')::uuid and read_at is not null) then raise exception 'recipient_cannot_mark_read'; end if;
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"15a00000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','15a00000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $test$ begin
 if exists(select 1 from public.announcements where id=current_setting('stage15.announcement')::uuid) then raise exception 'cross_property_published_visible'; end if;
 if exists(select 1 from public.notifications where target_id=current_setting('stage15.announcement')::uuid) then raise exception 'cross_property_notice_visible'; end if;
end $test$;
reset role;

select 'stage15_announcements_passed_rollback' as result;
rollback;
