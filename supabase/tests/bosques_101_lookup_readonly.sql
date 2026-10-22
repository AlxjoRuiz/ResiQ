-- Solo lectura. Localiza el apartamento 101 por código, sin asumir el nombre de la torre.
-- pruebaresidente@resiq.invalid es un marcador: en el SQL Editor usar el correo de la cuenta de prueba, sin guardarlo en el repo.
with target_member as (
  select pm.id, pm.status, pm.roles
  from public.property_members pm
  join auth.users au on au.id = pm.user_id
  where pm.property_id = '1bde3475-3ed2-4f57-bd13-39784b12d2a6'
    and lower(au.email) = 'pruebaresidente@resiq.invalid'
)
select
  b.name as torre,
  b.code as codigo_torre,
  u.code as apartamento,
  u.floor as piso,
  u.status as estado_apartamento,
  (select count(*) from target_member) as cuentas_encontradas,
  (select status from target_member limit 1) as estado_cuenta,
  (select roles from target_member limit 1) as roles_cuenta,
  (select string_agg(ob.name || ' · ' || ou.code, ', ' order by ob.name, ou.code)
   from public.unit_memberships existing
   join public.units ou on ou.id = existing.unit_id
   join public.buildings ob on ob.id = ou.building_id
   where existing.member_id = (select id from target_member limit 1)
     and existing.valid_to is null) as apartamentos_actuales,
  count(um.id) filter (where um.valid_to is null) as vinculos_activos_de_esta_cuenta,
  count(um.id) filter (where um.valid_to is not null) as vinculos_anteriores_de_esta_cuenta,
  (array_agg(um.relationship order by um.created_at desc) filter (where um.id is not null))[1] as ultima_relacion
from public.units u
join public.buildings b on b.id = u.building_id and b.property_id = u.property_id
left join target_member pm on true
left join public.unit_memberships um on um.unit_id = u.id and um.member_id = pm.id
where u.property_id = '1bde3475-3ed2-4f57-bd13-39784b12d2a6'
  and u.code = '101'
group by b.id, b.name, b.code, u.id, u.code, u.floor, u.status
order by b.name;
