-- Ejecutar únicamente desde un contexto administrativo controlado.
-- Antes: select set_config('app.platform_admin_user_id', '<UUID>', false);
insert into public.platform_admins(user_id, status, created_by)
select target_user_id, 'active', target_user_id
from (select current_setting('app.platform_admin_user_id', true)::uuid as target_user_id) configured
where target_user_id is not null
on conflict (user_id) do update set status = 'active', updated_at = now();
