-- Portería ya no registra recibos de servicios públicos (decisión de Alejandro, 25/10/2026).
-- La aplicación solo registra paquetes; aquí se retira el permiso de la función de recibos.
-- No se borra nada: los recibos ya registrados siguen visibles y se pueden entregar.
begin;

revoke execute on function public.register_utility_bill(uuid,uuid,uuid,text,text,text) from authenticated;

commit;

select not has_function_privilege('authenticated', 'public.register_utility_bill(uuid,uuid,uuid,text,text,text)', 'execute') as registro_de_recibos_cerrado,
  has_function_privilege('authenticated', 'public.register_package(uuid,uuid,uuid,text,text,text,text,text,text,text)', 'execute') as registro_de_paquetes_disponible;
