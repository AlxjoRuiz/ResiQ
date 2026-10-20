-- El tipo Propietario/Arrendatario se fija al aceptar la invitación.
-- La edición directa de vínculos existentes deja de estar disponible para la app.
revoke execute on function public.update_apartment_relationship(uuid,uuid,text) from authenticated;
