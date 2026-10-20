-- Solo lectura. Comprueba la cuenta confirmada y los vínculos de Torre 1 · 101.
with target_member as (
  select pm.id, pm.user_id, pm.roles, pm.status
  from public.property_members pm
  join auth.users au on au.id = pm.user_id
  where pm.property_id = '1bde3475-3ed2-4f57-bd13-39784b12d2a6'
    and lower(au.email) = 'alejoruizm11@gmail.com'
), target_unit as (
  select u.id, u.status, b.name as building_name
  from public.units u
  join public.buildings b on b.id = u.building_id and b.property_id = u.property_id
  where u.property_id = '1bde3475-3ed2-4f57-bd13-39784b12d2a6'
    and b.name = 'Torre 1'
    and u.code = '101'
), link_summary as (
  select
    count(*) filter (where um.valid_to is null) as active_links,
    count(*) filter (where um.valid_to is not null) as ended_links,
    (array_agg(um.relationship order by um.created_at desc))[1] as last_relationship,
    bool_or(um.finance_access) filter (where um.valid_to is null) as active_finance_access
  from public.unit_memberships um
  join target_member pm on pm.id = um.member_id
  join target_unit u on u.id = um.unit_id
)
select
  (select count(*) from target_member) as account_count,
  (select status from target_member limit 1) as account_status,
  (select roles from target_member limit 1) as account_roles,
  (select count(*) from target_unit) as apartment_count,
  (select status from target_unit limit 1) as apartment_status,
  active_links,
  ended_links,
  last_relationship,
  active_finance_access
from link_summary;
