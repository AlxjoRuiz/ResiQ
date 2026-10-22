-- Retira las cuentas antiguas del piloto y deja solo las de prueba @resiq.invalid,
-- los administradores activos y los superadministradores. No escribe correos reales.
--   * Sin historial en ninguna propiedad: se borran el perfil y la cuenta de Auth.
--   * Con historial: se revoca la membresía, se cierra cualquier vínculo vigente,
--     se bloquea el ingreso y se reemplazan correo y nombre por marcadores.
--     Los registros históricos quedan, sin datos de contacto en Auth.
-- Irreversible. Ejecutar el archivo completo en SQL Editor. Todo ocurre en un solo
-- bloque: si los conteos no coinciden con lo revisado (6 cuentas: 5 con historial
-- y 1 sin historial) o algo falla, no se guarda ningún cambio.
do $retire$
declare
  history_ids uuid[];
  empty_ids uuid[];
begin
  select coalesce(array_agg(au.id order by au.created_at) filter (where h.has_history), '{}'),
         coalesce(array_agg(au.id) filter (where not h.has_history), '{}')
  into history_ids, empty_ids
  from auth.users au
  cross join lateral (
    select exists (select 1 from public.property_members pm where pm.user_id = au.id) as has_history
  ) h
  where lower(au.email) not like '%@resiq.invalid'
    and not exists (select 1 from public.property_members pm where pm.user_id = au.id and pm.status = 'active')
    and not exists (select 1 from public.platform_admins pa where pa.user_id = au.id and pa.status = 'active');

  if cardinality(history_ids) <> 5 or cardinality(empty_ids) <> 1 then
    raise exception 'conteo_inesperado: % con historial y % sin historial; revisar el inventario',
      cardinality(history_ids), cardinality(empty_ids);
  end if;

  -- Cuentas con historial: revocar y cerrar vínculos.
  update public.property_members
  set status = 'revoked', revoked_at = coalesce(revoked_at, now())
  where user_id = any(history_ids) and status <> 'revoked';

  update public.unit_memberships um
  set valid_to = greatest(now(), um.valid_from + interval '1 microsecond')
  from public.property_members pm
  where um.member_id = pm.id and um.property_id = pm.property_id
    and pm.user_id = any(history_ids) and um.valid_to is null;

  -- Cuentas con historial: anonimizar identidad y bloquear ingreso.
  update public.profiles p
  set display_name = 'Usuario retirado ' || t.n, avatar_url = null
  from unnest(history_ids) with ordinality as t(id, n)
  where p.id = t.id;

  update auth.users au
  set email = 'retirado-' || t.n || '@resiq.invalid',
      phone = null,
      raw_user_meta_data = jsonb_build_object('display_name', 'Usuario retirado ' || t.n),
      banned_until = now() + interval '100 years'
  from unnest(history_ids) with ordinality as t(id, n)
  where au.id = t.id;

  delete from auth.identities where user_id = any(history_ids);
  delete from auth.sessions where user_id = any(history_ids);

  -- Cuenta sin historial: borrar perfil y cuenta. Si algo la referencia, la
  -- restricción de clave foránea aborta todo el bloque.
  delete from public.profiles where id = any(empty_ids);
  delete from auth.users where id = any(empty_ids);
end;
$retire$;

select au.email, au.banned_until is not null as bloqueada,
  (select string_agg(p.name || ': ' || array_to_string(pm.roles, '/') || ' (' || pm.status || ')', '; ')
     from public.property_members pm join public.properties p on p.id = pm.property_id
    where pm.user_id = au.id) as roles
from auth.users au order by au.created_at;
