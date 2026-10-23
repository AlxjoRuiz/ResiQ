-- Portería ve las convocatorias publicadas de asambleas, solo lectura (decisión de Alejandro,
-- 25/10/2026). No se amplía private.can_read_assembly: el portero no accede a orden del día,
-- documentos, asistentes ni poderes, y no puede responder ni confirmar asistencia.
begin;

create or replace function public.list_concierge_assemblies(target_property_id uuid)
returns table(assembly_id uuid, assembly_type text, title text, description text, starts_at timestamptz,
              location text, status text, cancellation_reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'concierge') then raise exception 'not_authorized'; end if;
  return query
  select a.id, a.type, a.title, a.description, a.starts_at, a.location, a.status, a.cancellation_reason
  from public.assemblies a
  where a.property_id = target_property_id and a.published_at is not null
  order by a.starts_at desc
  limit 30;
end;
$$;
revoke all on function public.list_concierge_assemblies(uuid) from public, anon;
grant execute on function public.list_concierge_assemblies(uuid) to authenticated;

commit;

select has_function_privilege('authenticated', 'public.list_concierge_assemblies(uuid)', 'execute') as convocatorias_para_porteria;
