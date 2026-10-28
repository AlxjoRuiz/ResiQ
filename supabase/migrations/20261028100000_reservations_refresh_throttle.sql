-- Rendimiento (28/10/2026, prueba de carga): refresh_reservations se llamaba en cada visita a Reservas
-- e Inicio de administración y escribía cada vez. Ahora actualiza vencidas y finalizadas como máximo
-- una vez por minuto por conjunto; si otra visita ya lo está haciendo, sigue sin esperar. Las
-- acciones de reservar, aprobar y cancelar siguen actualizando los estados al momento.
begin;

alter table public.property_policies add column reservations_refreshed_at timestamptz;

create or replace function public.refresh_reservations(target_property_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_active_member(target_property_id) then raise exception 'not_authorized'; end if;
  -- Ya se actualizó hace menos de un minuto: nada que hacer (lectura sin bloqueo).
  if exists(select 1 from public.property_policies where property_id=target_property_id and reservations_refreshed_at > now() - interval '60 seconds') then return; end if;
  -- Solo una visita a la vez por conjunto hace la actualización; las demás no esperan.
  if not pg_try_advisory_xact_lock(hashtextextended('reservations_refresh:' || target_property_id::text, 0)) then return; end if;
  insert into public.property_policies(property_id) values(target_property_id) on conflict do nothing;
  update public.property_policies set reservations_refreshed_at=now() where property_id=target_property_id;
  perform private.refresh_reservation_states(target_property_id);
end;
$$;

commit;

select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='property_policies' and column_name='reservations_refreshed_at') as marca_de_tiempo,
  pg_get_functiondef('public.refresh_reservations(uuid)'::regprocedure) like '%pg_try_advisory_xact_lock%' as actualizacion_limitada;
