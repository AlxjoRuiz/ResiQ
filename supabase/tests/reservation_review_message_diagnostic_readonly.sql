-- Solo lectura. Comprueba si el mensaje de aprobación quedó guardado
-- en las últimas reservas de Bosques; no muestra datos personales.
select
  r.status,
  r.created_at,
  r.purpose is not null as has_purpose,
  r.review_message is not null as has_review_message,
  r.review_message = 'Aprobada para prueba técnica' as matches_test_message
from public.reservations r
where r.property_id = '1bde3475-3ed2-4f57-bd13-39784b12d2a6'
order by r.created_at desc
limit 5;
